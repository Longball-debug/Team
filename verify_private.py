"""Fail deployment closed unless both the website and data are behind Cloudflare Access."""
import sys,urllib.request,urllib.error,urllib.parse
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def access_gate(url):
    request=urllib.request.Request(url,headers={'Cache-Control':'no-cache','User-Agent':'FantasyGM2027/1.0'})
    try:
        response=urllib.request.build_opener(NoRedirect()).open(request,timeout=20)
        code=response.status;location=response.headers.get('Location','');auth=response.headers.get('X-FantasyGM-Auth','')
    except urllib.error.HTTPError as e:
        code=e.code;location=e.headers.get('Location','');auth=e.headers.get('X-FantasyGM-Auth','')
    host=urllib.parse.urlparse(location).hostname or ''
    return (code==401 and auth=='password-required') or (code in (302,303,307) and host.endswith('.cloudflareaccess.com'))
def main():
    base=sys.argv[1].rstrip('/')
    for path in ('/','/public/fantasygm.json','/public/scoring-model.json'):
        if not access_gate(base+path):
            raise SystemExit('Private deployment blocked: the private authentication gate is not verified for website and data paths.')
    print('Verified unauthenticated requests require authentication on website and data paths.')
if __name__=='__main__':main()
