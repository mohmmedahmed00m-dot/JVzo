#!/bin/bash
ROOT=/tmp/alk-test/affiliate-launch-kit
pkill -f "node dist/main.js" 2>/dev/null; pkill -f vite 2>/dev/null; sleep 1

[ -f $ROOT/backend/dist/main.js ] || (cd $ROOT/backend && npm run build --silent)

node $ROOT/backend/dist/main.js > /tmp/zb.log 2>&1 &
BPID=$!
[ -d $ROOT/frontend/node_modules ] || (cd $ROOT/frontend && npm install --no-audit --no-fund --silent)
(cd $ROOT/frontend && npm run dev) > /tmp/zf.log 2>&1 &
FPID=$!

BK=0
for i in $(seq 1 45); do
  c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/campaigns 2>/dev/null)
  echo "$c" | grep -qE "^(401|403|200)$" && { echo "backend ready ($c) ${i}s"; BK=1; break; }
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
echo "===== فحص حقيقي للـ dev server من نسخة الـ ZIP ====="
FE=$(curl -s http://localhost:5173/ | grep -c 'id="root"')
echo "Frontend index يُخدَم؟    $FE  (نتوقع 1)"
REG=$(curl -s -X POST http://localhost:5173/api/auth/register -H "Content-Type: application/json" -d '{"email":"zip8@x.com","password":"testtest123"}' | grep -c 'access_token')
echo "Proxy /api/register؟     $REG  (نتوقع 1)"
MT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/src/main.tsx)
echo "main.tsx يُحوَّل؟         $MT  (نتوقع 200)"
CSS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/src/styles/tokens.css)
echo "tokens.css يُخدَم؟        $CSS  (نتوقع 200)"
ERRS=$(grep -ciE "error|exception" /tmp/zb.log)
echo "أخطاء backend؟           $ERRS  (نتوقع 0)"

kill $BPID $FPID 2>/dev/null
echo ""
if [ "$FE" = "1" ] && [ "$REG" = "1" ] && [ "$MT" = "200" ] && [ "$ERRS" = "0" ]; then
  echo "✅ الخلاصة: الـ ZIP يعمل 100% — build + dev server + proxy نظيف"
else
  echo "✗ الخلاصة: توجد مشكلة (انظر الأعلى)"
fi
