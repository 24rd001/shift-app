import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext, isAdmin } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { forbidden, internalError, ok, unauthorized } from '../../utils/response';


export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();
  if (!isAdmin(auth)) return forbidden('Admin access required');


  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.SHIFTS,
      }),
    );

    const shifts = result.Items ?? [];

    return ok({ shifts });
  } catch (err) {
    console.error('[getAdminShifts] error:', err);
    return internalError();
  }
};