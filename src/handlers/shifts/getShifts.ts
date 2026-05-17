import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { internalError, ok, unauthorized } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();

  try {
    const { date, userId } = event.queryStringParameters ?? {};

    const filterParts: string[] = [];
    const attrValues: Record<string, string> = {};
    const attrNames: Record<string, string> = {};

    if (date) {
      filterParts.push('#d = :date');
      attrNames['#d'] = 'date';
      attrValues[':date'] = date;
    }
    if (userId) {
      filterParts.push('userId = :uid');
      attrValues[':uid'] = userId;
    }

    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.SHIFTS,
        ...(filterParts.length > 0 && {
          FilterExpression: filterParts.join(' AND '),
          ExpressionAttributeValues: attrValues,
          ...(Object.keys(attrNames).length > 0 && {
            ExpressionAttributeNames: attrNames,
          }),
        }),
      }),
    );

    return ok({ shifts: result.Items ?? [] });
  } catch (err) {
    console.error('[getShifts] error:', err);
    return internalError();
  }
};
