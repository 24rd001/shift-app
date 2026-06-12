import { GetCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext, isAdmin } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { badRequest, forbidden, internalError, notFound, ok, unauthorized } from '../../utils/response';

interface SwapResponse {
  userId: string;
  accept: boolean | null;
  comment?: string | null;
  respondedAt: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();
  if (!isAdmin(auth)) return forbidden('Admin access required');

  const swapId = event.pathParameters?.id;
  if (!swapId) return badRequest('swap ID is required');

  // リクエストボディから approve / reject を判定
  let body: { approve?: boolean; reject?: boolean } = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return badRequest('Invalid request body');
  }

  const isApproveAction = body.approve === true;
  const isRejectAction = body.reject === true;

  if (!isApproveAction && !isRejectAction) {
    return badRequest('Request body must contain either { "approve": true } or { "reject": true }');
  }

  try {
    const swap = await docClient.send(
      new GetCommand({ TableName: TABLES.SWAP_REQUESTS, Key: { swapId } }),
    );

    if (!swap.Item) return notFound('Swap request not found');
    if (swap.Item['status'] !== 'pending' && swap.Item['status'] !== 'responded') {
      return badRequest(`Swap request is already ${swap.Item['status'] as string}`);
    }

    const { shiftId, requesterId } = swap.Item as { shiftId: string; requesterId: string };

    // ── 拒否処理 ──────────────────────────────────────────
    if (isRejectAction) {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.SWAP_REQUESTS,
          Key: { swapId },
          UpdateExpression: 'SET #s = :rejected, rejectedBy = :adminId, rejectedAt = :now',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':rejected': 'rejected',
            ':adminId': auth.userId,
            ':now': new Date().toISOString(),
          },
        }),
      );

      return ok({
        message: 'Swap rejected successfully',
        swapId,
        shiftId,
        requesterId,
      });
    }

    // ── 承認処理 ──────────────────────────────────────────
    const responses = (swap.Item['responses'] ?? []) as SwapResponse[];

    // accept: true を優先、いなければ accept: null（相談）のスタッフを交代相手にする
    const acceptedResponse =
      responses.find((r) => r.accept === true) ??
      responses.find((r) => r.accept === null);

    if (!acceptedResponse) {
      return badRequest('No staff member has responded to this swap yet');
    }

    const newAssigneeId = acceptedResponse.userId;

    // DynamoDB トランザクション: 2つの更新を原子的に実行
    // どちらか一方が失敗した場合、もう一方もロールバックされる
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: TABLES.SWAP_REQUESTS,
              Key: { swapId },
              UpdateExpression:
                'SET #s = :approved, approvedBy = :adminId, approvedAt = :now',
              ExpressionAttributeNames: { '#s': 'status' },
              ExpressionAttributeValues: {
                ':approved': 'approved',
                ':adminId': auth.userId,
                ':now': new Date().toISOString(),
              },
            },
          },
          {
            Update: {
              TableName: TABLES.SHIFTS,
              Key: { shiftId },
              UpdateExpression: 'SET userId = :newUserId',
              ExpressionAttributeValues: { ':newUserId': newAssigneeId },
            },
          },
        ],
      }),
    );

    return ok({
      message: 'Swap approved successfully',
      swapId,
      shiftId,
      previousAssignee: requesterId,
      newAssignee: newAssigneeId,
    });
  } catch (err) {
    console.error('[approveSwap] error:', err);
    return internalError();
  }
};