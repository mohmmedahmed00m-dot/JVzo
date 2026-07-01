# STEP 2 — جدول الحكم (Audit Findings)

| # | الملف + الموقع | نوع العيب | التصنيف | الأثر لو تُرك | الأولوية |
|---|---|---|---|---|---|
| 1 | `licensing.service.ts` `verifyJvzooSignature`: مقارنة `computed === received` | مقارنة سرّ غير ثابتة الزمن | أمان | توقيع JVZoo قابل للتزوير نظرياً عبر هجوم التوقيت | **P1** |
| 2 | `migrations/...Init`: `licenses.jvzoo_transaction_id` بلا قيد UNIQUE | غياب قيد سلامة | تزامن/سلامة-بيانات | IPN مكرّر متزامن يُنشئ ترخيصين؛ أحدهما قد يفلت من الإبطال بعد الاسترجاع | **P1** |
| 3 | `licensing.service.ts` `handleJvzooIpn` SALE: `findOne` ثم `save` غير ذرّي | TOCTOU race | تزامن | نفس أثر #2 على مستوى التطبيق | **P1** |
| 4 | `campaigns.service.ts` `create()`: Campaign ثم Assets بمعاملات منفصلة | انتهاك مبدأ المخطط 1.3 (transaction boundary واحد) | موثوقية/سلامة-بيانات | تعطّص وسط التوليد يُبقي حملة بوضع `generating` وأصول جزئية غير متناسقة | **P2** |
| 5 | `campaigns.service.ts` `updateAsset()`: تعديل HTML يدوي بلا تعقيم | لا يمرّ عبر Sanitizer | أمان | مستخدم يلصق `<script>` → يُحفظ خاماً → يُعرض في المعاينة ويُصدَّر (XSS ذاتي + عند المشاركة) | **P2** |
| 6 | `generators.service.ts` `persistAsset`: `findOne` ثم `save` + لا UNIQUE على `(campaign_id, asset_type)` | TOCTOU race | تزامن | regenerate متزامن يُنشئ صفّي أصل مكرّرين | **P2** |
| 7 | `licensing.service.ts` `activateLicenseForUser`: حفظ `user` ثم `license` بمعاملتين | ليست في transaction | سلامة-بيانات | فشل الكتابة الثانية يُبقي ربطاً جزئياً متناقضاً | **P2** |
| 8 | `auth.service.ts` `issueTokens`: `email:''` hardcoded في payload | قيمة ميتة مضلّلة | جودة-كود | لا أثر وظيفي (JwtStrategy يقرأ email من DB) | P3 |
| 9 | `licensing.service.ts`: `require('crypto')` داخل الدالة | استيراد مضمن | جودة-كود | أداء/وضوح | P3 |
| 10 | `licensing.controller.ts`: 400 عند توقيع سيئ + لا catch للأخطاء الداخلية | سلوك webhook | موثوقية ( قابل للنقاش) | خطأ DB مؤقت → 500 → إعادة محاولة JVZoo (مقبول) لكن لا فصل واضح | P3 |
| 11 | وحدة Export: لا فرض/تنظيف لاحتفاظ 30 يوماً | انحراف عن المخطط 8.4 | انحراف-عن-المخطط | روابط تنزيل قديمة تبقى صالحة إلى الأبد | P3 |
| 12 | `Editor.tsx` L184: `dangerouslySetInnerHTML` على `currentDraft` | سطح XSS في المعاينة | أمان | يُحلّ بـ #5 (التعقيم عند الحفظ) + المعاينة محدودة | P2 |

> لا يوجد **P0** (لا تجاوز مصادقة، لا حقن SQL — كل الاستعلامات معاملات، لا كلمات مرور مكشوفة، لا تسرّب مفاتيح). النظام يعمل لكن العيوب أعلاه حقيقية ويجب إصلاح P1+P2 قبل شهادة الإنتاج.
