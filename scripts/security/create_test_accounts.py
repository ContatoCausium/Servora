import os,json,requests,re,secrets
env=dict(re.findall(r'^(\w+)="?([^"\n]*)"?',open('/dev-server/.env').read(),re.M))
U=env['VITE_SUPABASE_URL'];K=env['VITE_SUPABASE_PUBLISHABLE_KEY']
H=lambda t=None:{"apikey":K,"Content-Type":"application/json",**({"Authorization":"Bearer "+t} if t else {})}
tag=secrets.token_hex(3); PW="Test-Pass-9271!"
emails={r:f"servora.sec.{r}.{tag}@mailinator.com" for r in "ABMSX"}
for e in emails.values(): requests.post(U+"/auth/v1/signup",headers=H(),json={"email":e,"password":PW})
open('/tmp/sec/emails.json','w').write(json.dumps(emails))
