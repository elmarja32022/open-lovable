# دليل تجهيز Open Lovable للإنتاج + Supabase

هذا الدليل السريع يوضح كيف تجعل المشروع أقرب لمستوى الإنتاج، وكيف تربط المشاريع المولدة بقاعدة بيانات مجانية مثل Supabase.

## 1) متطلبات الإنتاج الأساسية

- اضبط `NEXT_PUBLIC_APP_URL` على الدومين الحقيقي.
- استخدم مفاتيح مزود AI مستقرة (يفضل `AI_GATEWAY_API_KEY`).
- لا تضع المفاتيح السرية في الواجهة الأمامية.
- فعّل سجلات ومراقبة الاستضافة (Vercel Observability أو بديل).

## 2) إعداد Supabase (الخطة المجانية)

1. أنشئ مشروعًا جديدًا من https://supabase.com
2. انسخ المتغيرات التالية إلى `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## 3) قواعد أمان مهمة

- `NEXT_PUBLIC_SUPABASE_*` مسموح في الواجهة الأمامية.
- `SUPABASE_SERVICE_ROLE_KEY` للخادم فقط (API routes / server actions).
- فعّل RLS لكل الجداول قبل الإطلاق.
- اكتب سياسات واضحة (قراءة/كتابة) حسب المستخدم أو الدور.

## 4) نصائح جاهزية إنتاج

- أضف معالجة أخطاء واضحة في عمليات القراءة/الكتابة.
- أضف حالة تحميل (loading) وحالة فشل (error) في الواجهات.
- تحقق من صحة المدخلات قبل إرسالها.
- اختبر سيناريوهات الصلاحيات بعد تفعيل RLS.
