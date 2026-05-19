import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getAuthContext } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { badRequest, created, forbidden, internalError, notFound, unauthorized } from '../../utils/response';

interface CreateSwapRequestBody {
  shiftId: string;
  targetEmail: string;  // 追加
  reason?: string;      // 追加（?は任意という意味）
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();

  if (!event.body) return badRequest('Request body is required');

  let body: CreateSwapRequestBody;
  try {
    body = JSON.parse(event.body) as CreateSwapRequestBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  if (!body.shiftId) return badRequest('shiftId is required');
  if (!body.targetEmail) return badRequest('targetEmail is required');

  try {
    // シフトの存在確認と所有権チェック
    const shiftResult = await docClient.send(
      new GetCommand({ TableName: TABLES.SHIFTS, Key: { shiftId: body.shiftId } }),
    );

    if (!shiftResult.Item) return notFound('Shift not found');
    if (shiftResult.Item['userId'] !== auth.userId) {
      return forbidden('You can only request swaps for your own shifts');
    }

    const item = {
  swapId: uuidv4(),
  requesterId: auth.userId,
  shiftId: body.shiftId,
  targetEmail: body.targetEmail,  // 追加
  reason: body.reason ?? null,    // 追加（??はnullの場合nullを入れる）
  status: 'pending' as const,
  responses: [] as Array<{ userId: string; accept: boolean; respondedAt: string }>,
  createdAt: new Date().toISOString(),
};

    await docClient.send(new PutCommand({ TableName: TABLES.SWAP_REQUESTS, Item: item }));

    return created({ swapRequest: item });
  } catch (err) {
    console.error('[createSwapRequest] error:', err);
    return internalError();
  }
};
