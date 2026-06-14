import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { badRequest, internalError, notFound, ok, unauthorized } from '../../utils/response';

interface ReactBody {
  type: 'ok' | 'meh' | 'q';
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();

  const noticeId = event.pathParameters?.id;
  if (!noticeId) return badRequest('noticeId is required');

  if (!event.body) return badRequest('Request body is required');

  let body: ReactBody;
  try {
    body = JSON.parse(event.body) as ReactBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  const VALID_TYPES = ['ok', 'meh', 'q'];
  if (!VALID_TYPES.includes(body.type)) {
    return badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`);
  }

  try {
    const existing = await docClient.send(
      new GetCommand({ TableName: TABLES.NOTICES, Key: { noticeId } }),
    );
    if (!existing.Item) return notFound('Notice not found');

    // reactions は { userId: type } のMapとして保存
    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.NOTICES,
        Key: { noticeId },
        UpdateExpression: 'SET reactions.#uid = :type',
        ExpressionAttributeNames: { '#uid': auth.userId },
        ExpressionAttributeValues: { ':type': body.type },
      }),
    );

    return ok({ message: 'Reaction saved', noticeId, userId: auth.userId, type: body.type });
  } catch (err) {
    console.error('[reactToNotice] error:', err);
    return internalError();
  }
};