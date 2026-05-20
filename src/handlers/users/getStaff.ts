import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { internalError, ok, unauthorized } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();

  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.USERS,
      }),
    );

    return ok({ staff: result.Items ?? [] });
  } catch (err) {
    console.error('[getStaff] error:', err);
    return internalError();
  }
};