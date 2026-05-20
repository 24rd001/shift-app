// AWS Lambdaのイベント・レスポンスの型定義をインポート
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// 認証チェック用の関数をインポート
import { getAuthContext } from '../../middleware/auth';

// レスポンスを返す関数をインポート
import { internalError, ok, unauthorized } from '../../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  
  // JWTトークンからログインユーザーの情報を取得
  // ログインしていなければ401（Unauthorized）を返して処理を終了
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();

  try {
    // 現時点ではお知らせ機能は未実装
    // フロントがエラーにならないよう空配列を返しておく
    // 今後ここにDynamoDBからお知らせを取得する処理を追加する
    return ok({ notices: [] });

  } catch (err) {
    // 予期しないエラーが起きた場合は500を返す
    console.error('[getNotices] error:', err);
    return internalError();
  }
};