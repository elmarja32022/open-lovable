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

## 4) تطبيق ممارسات الجودة المطلوبة

### أ) معالجة أخطاء واضحة في عمليات القراءة/الكتابة

استخدم نتيجة Supabase (`data` + `error`) بشكل صريح، ثم اعرض رسالة مفهومة للمستخدم وسجل التفاصيل تقنيًا:

```ts
const { data, error } = await supabase.from("tasks").insert({ title });

if (error) {
  console.error("[tasks.insert] Failed to create task:", error);
  setUiError("تعذر حفظ المهمة. تأكد من الصلاحيات أو أعد المحاولة.");
  return;
}

return data;
```

**نصيحة:** لا تعرض `error.message` الخام مباشرة للمستخدم النهائي إذا كانت تحتوي معلومات داخلية.

### ب) إضافة حالة تحميل (loading) وحالة فشل (error) في الواجهة

أبسط نمط موثوق في React:

```tsx
const [loading, setLoading] = useState(false);
const [errorMessage, setErrorMessage] = useState<string | null>(null);

async function onSubmit() {
  setLoading(true);
  setErrorMessage(null);

  try {
    // write/read request
  } catch (e) {
    setErrorMessage("حدث خطأ غير متوقع. حاول مرة أخرى.");
  } finally {
    setLoading(false);
  }
}
```

وفي الواجهة:

- عطّل الزر أثناء التحميل.
- اعرض Spinner أو نص `جاري التحميل...`.
- اعرض رسالة خطأ واضحة مع زر "إعادة المحاولة".

### ج) التحقق من صحة المدخلات قبل الإرسال

تحقق على **مستويين**:

1. **واجهة المستخدم (Client-side):**
   - حقول مطلوبة (required)
   - طول النصوص
   - تنسيق البريد/الهاتف
2. **الخادم (Server-side):**
   - أعد نفس التحقق في Route/Action حتى لو تحقق في الواجهة.

مثال سريع (zod):

```ts
import { z } from "zod";

const taskSchema = z.object({
  title: z.string().min(3, "العنوان قصير جدًا").max(120, "العنوان طويل جدًا"),
});

const parsed = taskSchema.safeParse(formData);
if (!parsed.success) {
  return {
    ok: false,
    error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
  };
}
```

### د) اختبار سيناريوهات الصلاحيات بعد تفعيل RLS

بعد تفعيل RLS، اختبر على الأقل السيناريوهات التالية:

1. **مستخدم غير مسجل (anon):**
   - لا يستطيع القراءة/الكتابة على الجداول الخاصة.
2. **مستخدم مسجل يقرأ بياناته فقط:**
   - `select` ينجح لصفوفه ويفشل لصفوف مستخدم آخر.
3. **مستخدم مسجل يكتب بياناته فقط:**
   - `insert/update/delete` ينجح عندما `user_id = auth.uid()`.
4. **اختبار سياسات سلبية (Negative tests):**
   - محاولة الوصول المتعمد لبيانات غير مصرح بها يجب أن تُرفض.

مثال سياسة شائعة:

```sql
create policy "users_can_read_own_tasks"
on public.tasks
for select
using (auth.uid() = user_id);

create policy "users_can_insert_own_tasks"
on public.tasks
for insert
with check (auth.uid() = user_id);
```

**قائمة تحقق قبل الإطلاق:**

- [ ] كل استدعاء قراءة/كتابة يعالج `error` بوضوح.
- [ ] كل شاشة CRUD فيها `loading` + `error`.
- [ ] كل النماذج فيها تحقق مدخلات قبل وبعد الإرسال.
- [ ] تم تنفيذ اختبارات RLS لحالات السماح والمنع.
