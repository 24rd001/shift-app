import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext, isAdmin } from '../../middleware/auth';
import { docClient, TABLES } from '../../utils/dynamodb';
import { badRequest, created, forbidden, internalError, unauthorized } from '../../utils/response';

interface CreateNoticeBody {
  title: string;
  body: string;
  tag?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = getAuthContext(event);
  if (!auth) return unauthorized();
  if (!isAdmin(auth)) return forbidden('Admin access required');

  if (!event.body) return badRequest('Request body is required');

  let body: CreateNoticeBody;
  try {
    body = JSON.parse(event.body) as CreateNoticeBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  if (!body.title?.trim()) return badRequest('title is required');
  if (!body.body?.trim())  return badRequest('body is required');

  try {
    const noticeId = String(Date.now());
    const item = {
      noticeId,
      title:     body.title.trim(),
      body:      body.body.trim(),
      tag:       body.tag ?? null,
      postedBy:  auth.userId,
      reactions: {},
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({ TableName: TABLES.NOTICES, Item: item }));

    return created({ notice: item });
  } catch (err) {
    console.error('[createNotice] error:', err);
    return internalError();
  }
};