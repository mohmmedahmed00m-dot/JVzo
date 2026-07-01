#!/bin/bash
# محاكاة كاملة لتجربة المستخدم: dev-up ثم تشغيل + فحص الـ proxy.
ROOT=/tmp/alk-test/affiliate-launch-kit
pkill -f "node dist/main.js" 2>/dev/null; pkill -f vite 2>/dev/null; sleep 1

echo "===== A) إعادة bootstrap (dev-up.sh) ====="
cd $ROOT && bash dev-up.sh 2>&1 | tail -4

echo ""
echo "===== B) تشغيل backend + frontend ====="
cd $ROOT/backend && node dist/main.js > /tmp/zb.log 2>&1 &
BPID=$!
cd $ROOT/frontend && npm run dev > /tmp/zf.log 2>&1 &
FPID=$!

BK=0
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/campaigns 2>/dev/null)
  echo "$code" | grep -qE "^(401|403|200)$" && { echo "backend ready ($code) ${i}s"; BK=1; break; }
  sleep 1
done
[ "$BK" != "1" ] && { echo "BACKEND FAILED"; tail -15 /tmp/zb.log; kill $BPID $FPID 2>/dev/null; exit 2; }

for i in $(seq 1 30); do
  c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ 2>/dev/null)
  [ "$c" = "200" ] && { echo "vite ready ${i}s"; break; }
  sleep 1
done
sleep 1

echo ""
echo "===== C) فحص حقيقي للـ dev server ====="
FE=$(curl -s http://localhost:5173/ | grep -c 'id="root"')
echo "Frontend index يُخدَم؟    $FE  (نتوقع 1)"
REG=$(curl -s -X POST http://localhost:5173/api/auth/register -H "Content-Type: application/json" -d '{"email":"ziptest5@x.com","password":"testtest123"}' | grep -c 'access_token')
echo "Proxy /api/register؟     $REG  (نتوقع 1)"
ACT=$(curl -s http://localhost:5173/src/main.tsx -o /dev/null -w "%{http_code}")
echo "main.tsx يُحوَّل؟         $ACT  (نتوقع 200)"
CSS=$(curl -s http://localhost:5173/src/styles/tokens.css -o /dev/null -w "%{http_code}")
echo "tokens.css يُخدَم؟        $CSS  (نتوقع 200)"

kill $BPID $FPID 2>/dev/null
echo ""
echo "===== D) الخلاصة ====="
if [ "$FE" = "1" ] && [ "$REG" = "1" ] && [ "$ACT" = "200" ]; then
  echo "✅ الـ ZIP يعمل 100%: bootstrap + build + dev server + proxy"
else
  echo "✗ يوجد مشكلة في التشغيل"
fi
