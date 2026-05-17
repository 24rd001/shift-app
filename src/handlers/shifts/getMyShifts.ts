import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { internalError, ok, unauthorized } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();

  try {
    // GSI (userId-date-index) を使って自分のシフトだけを効率的に取得
    // Scan（全件）ではなく Query（インデックス指定）でO(1)に近いコストで検索
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.SHIFTS,
        IndexName: 'userId-date-index',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': auth.userId },
        ScanIndexForward: true, // 日付昇順
      }),
    );

    return ok({ shifts: result.Items ?? [] });
  } catch (err) {
    console.error('[getMyShifts] error:', err);
    return internalError();
  }
};
