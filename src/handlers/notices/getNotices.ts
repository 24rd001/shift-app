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
      new ScanCommand({ TableName: TABLES.NOTICES }),
    );

    // 新しい順に並び替え
    const notices = (result.Items ?? []).sort((a, b) =>
      (b.createdAt as string).localeCompare(a.createdAt as string),
    );

    return ok({ notices });
  } catch (err) {
    console.error('[getNotices] error:', err);
    return internalError();
  }
};