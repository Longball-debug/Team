import { readSnapshot } from '../../shared/fantrax';
export async function GET() {
  return Response.json(await readSnapshot(), {headers:{'Cache-Control':'no-store'}});
}
