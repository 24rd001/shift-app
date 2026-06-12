import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext, isAdmin } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { badRequest, forbidden, internalError, notFound, ok, unauthorized } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();
  if (!isAdmin(auth)) return forbidden('Admin access required');

  const requestId = event.pathParameters?.id;
  if (!requestId) return badRequest('requestId is required');

  try {
    // 存在確認
    const existing = await docClient.send(
      new GetCommand({ TableName: TABLES.SHIFT_REQUESTS, Key: { requestId } }),
    );
    if (!existing.Item) return notFound('Wish not found');

    // 削除
    await docClient.send(
      new DeleteCommand({ TableName: TABLES.SHIFT_REQUESTS, Key: { requestId } }),
    );

    return ok({ message: 'Wish deleted successfully', requestId });
  } catch (err) {
    console.error('[deleteWish] error:', err);
    return internalError();
  }
};