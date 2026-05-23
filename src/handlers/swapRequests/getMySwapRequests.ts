// DynamoDBの操作に必要な道具を読み込む
import { ScanCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';

// AWS Lambdaの型定義を読み込む
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// 認証チェック用の関数を読み込む
import { getAuthContext } from '../../middleware/auth';

// DynamoDB接続を読み込む
import { docClient, TABLES } from '../../utils/dynamodb';

// レスポンス関数を読み込む
import { internalError, ok, unauthorized } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  
  // ① ログイン済みか確認
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();

  try {
    // ② SwapRequestsテーブルから自分宛の申請を全件取得
    // 自分が「送った申請」と「受け取った申請」の両方を取得
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.SWAP_REQUESTS,
        FilterExpression: 'requesterId = :uid OR targetEmail = :email',
        ExpressionAttributeValues: {
          ':uid': auth.userId,
          ':email': auth.email,
        },
      }),
    );

    const swaps = result.Items ?? [];

    // ③ 申請者の名前を取得するため、requesterIdの一覧を作る
    const requesterIds = [...new Set(swaps.map(s => s.requesterId))];

    if (requesterIds.length === 0) {
      return ok({ swaps });
    }

    // ④ Usersテーブルから申請者の情報を一括取得
    const usersResult = await docClient.send(
      new BatchGetCommand({
        RequestItems: {
          [TABLES.USERS]: {
            Keys: requesterIds.map(userId => ({ userId })),
          },
        },
      }),
    );

    const users = usersResult.Responses?.[TABLES.USERS] ?? [];
    const userMap = new Map(users.map(u => [u.userId, u]));

    // ⑤ 各申請に申請者の名前を追加
    const swapsWithNames = swaps.map(swap => ({
      ...swap,
      requesterName: userMap.get(swap.requesterId)?.name ?? '不明',
      requesterEmail: userMap.get(swap.requesterId)?.email ?? '',
      // 自分が申請者なら'sent'、受信者なら'received'
      direction: swap.requesterId === auth.userId ? 'sent' : 'received',
    }));

    return ok({ swaps: swapsWithNames });

  } catch (err) {
    console.error('[getMySwapRequests] error:', err);
    return internalError();
  }
};