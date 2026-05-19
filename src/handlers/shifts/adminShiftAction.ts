import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext, isAdmin } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { badRequest, forbidden, internalError, notFound, ok, unauthorized } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();
  if (!isAdmin(auth)) return forbidden('Admin access required');

  const shiftId = event.pathParameters?.id;
  const action = event.pathParameters?.action;

  if (!shiftId) return badRequest('shiftId is required');
  if (action !== 'approve' && action !== 'reject') return badRequest('action must be approve or reject');

  try {
    const shiftResult = await docClient.send(
      new GetCommand({ TableName: TABLES.SHIFTS, Key: { shiftId } }),
    );

    if (!shiftResult.Item) return notFound('Shift not found');

    const newStatus = action === 'approve' ? 'swapped' : 'cancelled';

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.SHIFTS,
        Key: { shiftId },
        UpdateExpression: 'SET #s = :status',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': newStatus },
      }),
    );

    return ok({
      message: action === 'approve' ? '承認しました' : '却下しました',
      shiftId,
      status: newStatus,
    });
  } catch (err) {
    console.error('[adminShiftAction] error:', err);
    return internalError();
  }
};