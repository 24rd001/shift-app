import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext, isAdmin } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { forbidden, internalError, ok, unauthorized } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();
  // API Gatewayで認証済みでも、adminグループ所属かをLambda内で再確認（多層防御）
  if (!isAdmin(auth)) return forbidden('Admin access required');

  try {
    const { month } = event.queryStringParameters ?? {};

    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.SHIFT_REQUESTS,
        ...(month && {
          FilterExpression: '#m = :month',
          ExpressionAttributeNames: { '#m': 'month' },
          ExpressionAttributeValues: { ':month': month },
        }),
      }),
    );

    return ok({ shiftRequests: result.Items ?? [] });
  } catch (err) {
    console.error('[getShiftRequests] error:', err);
    return internalError();
  }
};
