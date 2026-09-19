-- Kunni yopish/qayta ochish va muhrni faqat rahbar o'zgartira olsin.
--
-- Muammo: `days_update` siyosati faqat `org_id = auth_org_id()` ni
-- tekshiradi, ya'ni bog'chaning HAR QANDAY foydalanuvchisi
-- `attendance_days` ning istalgan ustunini yozishi mumkin edi —
-- `status`, `closed_by`, `day_seal` va `sealed_at` ham. Ya'ni tarbiyachi
-- yopilgan kunni qayta ochishi yoki yuridik dalil muhrini (TZ §11.6)
-- almashtirib yuborishi mumkin edi.
--
-- Nega faqat siyosat bilan hal qilinmaydi: RLS siyosati UPDATE'da OLD va
-- NEW qatorlarni solishtira olmaydi (USING faqat OLD'ni, WITH CHECK faqat
-- NEW'ni ko'radi), shuning uchun "bu ustunni o'zgartirmang" qoidasini
-- siyosat sifatida yozib bo'lmaydi.
--
-- Nega `days_update` ni butunlay rahbarga cheklamadik: `refresh_day_counts()`
-- SECURITY INVOKER trigger, ya'ni hisoblagichlarni yangilashda chaqiruvchi
-- rolining RLS'i amal qiladi. Tarbiyachi davomat belgilaganda o'sha trigger
-- `attendance_days` ni UPDATE qiladi — siyosatni rahbarga cheklasak,
-- tarbiyachining davomat belgilashi ishlamay qolardi. Ilovaning eng asosiy
-- vazifasini himoya qatlami uchun buzish noto'g'ri savdo.
--
-- Shuning uchun `guard_closed_day()` bilan bir uslubda trigger: faqat
-- nozik ustunlar o'zgarganda va faqat rahbar bo'lmaganda to'xtatadi.
-- Hisoblagich ustunlari ro'yxatda yo'q, shuning uchun trigger tegmaydi.

create or replace function guard_day_status_change() returns trigger
language plpgsql set search_path = public as $$
declare
  claims text := current_setting('request.jwt.claims', true);
  role_name text;
begin
  -- Rolni auth_user_role() orqali emas, shu yerda o'zimiz o'qiymiz.
  -- Sababi: u `current_setting(...)::jsonb` qiladi va sozlama BO'SH SATR
  -- bo'lsa (nafaqat NULL) cast "invalid input syntax for type json"
  -- bilan yiqiladi. Siyosatlar uchun bu muhim emas — ular faqat RLS'ga
  -- bo'ysunadigan rollar uchun hisoblanadi. Trigger esa HAR QANDAY
  -- UPDATE'da ishlaydi: service_role (adminDb), migratsiya, cron —
  -- ya'ni claims umuman yo'q yo'llarda ham. Tekshirmasak, kunni yopish
  -- va hisoblagichlarni yangilash ishlab chiqarishda yiqilardi.
  -- (Bu aynan shu migratsiyani sinashda yuz berdi.)
  if claims is null or claims = '' then
    return new;
  end if;

  begin
    role_name := (claims::jsonb) ->> 'user_role';
  exception when others then
    -- Buzuq claims — bu trigger uning hakami emas; RLS siyosatlari
    -- baribir yozuvni to'sadi.
    return new;
  end;

  if role_name is null or role_name in ('owner', 'director') then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.day_seal is distinct from old.day_seal
     or new.sealed_at is distinct from old.sealed_at
     or new.closed_at is distinct from old.closed_at
     or new.closed_by is distinct from old.closed_by
     or new.reopened_at is distinct from old.reopened_at
     or new.reopened_by is distinct from old.reopened_by
     or new.reopen_reason is distinct from old.reopen_reason
  then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists trg_guard_day_status_change on attendance_days;
create trigger trg_guard_day_status_change
  before update on attendance_days
  for each row execute function guard_day_status_change();

-- Ikkinchi teshik: `dispute_items_write` siyosatining USING qismida
-- `is_manager()` bor, WITH CHECK qismida esa yo'q. INSERT'da faqat WITH
-- CHECK ishlaydi (USING o'qish/o'zgartirish uchun) — ya'ni tarbiyachi
-- rahbarning da'vosiga yangi band qo'sha olardi, ya'ni davlatga
-- yuboriladigan yuridik hujjat tarkibini o'zgartira olardi. O'chirish va
-- tahrirlash to'g'ri to'silgan edi (USING ishlaydi), faqat qo'shish ochiq
-- qolgan. `disputes_write` da ikkala qismda ham bor — shu namunaga
-- keltiramiz.
drop policy if exists dispute_items_write on dispute_items;
create policy dispute_items_write on dispute_items for all
  using (
    is_manager()
    and dispute_id in (select id from disputes where org_id = auth_org_id())
    and check_id in (select id from state_checks where org_id = auth_org_id())
  )
  with check (
    is_manager()
    and dispute_id in (select id from disputes where org_id = auth_org_id())
    and check_id in (select id from state_checks where org_id = auth_org_id())
  );
