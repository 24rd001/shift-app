import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { badRequest, forbidden, internalError, notFound, ok, unauthorized } from '../../utils/response';

interface RespondBody {
  accept: boolean;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();

  const swapId = event.pathParameters?.id;
  if (!swapId) return badRequest('swap ID is required');

  if (!event.body) return badRequest('Request body is required');

  let body: RespondBody;
  try {
    body = JSON.parse(event.body) as RespondBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  if (typeof body.accept !== 'boolean') return badRequest('accept (boolean) is required');

  try {
    const swap = await docClient.send(
      new GetCommand({ TableName: TABLES.SWAP_REQUESTS, Key: { swapId } }),
    );

    if (!swap.Item) return notFound('Swap request not found');
    if (swap.Item['requesterId'] === auth.userId) {
      return forbidden('Cannot respond to your own swap request');
    }
    if (swap.Item['status'] !== 'pending') {
      return badRequest(`Swap request is already ${swap.Item['status'] as string}`);
    }

    const response = {
      userId: auth.userId,
      accept: body.accept,
      respondedAt: new Date().toISOString(),
    };

    // list_append でレスポンス配列に追加（上書きせず蓄積する）
    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.SWAP_REQUESTS,
        Key: { swapId },
        UpdateExpression: 'SET #r = list_append(#r, :newResponse)',
        ExpressionAttributeNames: { '#r': 'responses' },
        ExpressionAttributeValues: { ':newResponse': [response] },
      }),
    );

    return ok({ message: 'Response recorded', response });
  } catch (err) {
    console.error('[respondToSwap] error:', err);
    return internalError();
  }
};
