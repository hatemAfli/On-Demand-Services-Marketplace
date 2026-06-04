import { FaqAudience, Locale, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type FaqSeedRow = {
  audience: FaqAudience;
  sortOrder: number;
  en: { question: string; answer: string };
  ar: { question: string; answer: string };
};

/**
 * Realistic FAQ content inspired by common on-demand service marketplaces
 * (booking flow, payments, cancellations, verification, reviews, payouts).
 *
 * Run: npm run db:seed:faq
 */
const FAQ_ITEMS: FaqSeedRow[] = [
  // ── Everyone ──────────────────────────────────────────────────────────────
  {
    audience: FaqAudience.ALL,
    sortOrder: 0,
    en: {
      question: 'What is this platform?',
      answer:
        'We connect clients who need home and local services with verified independent providers and company teams. You can browse services, compare offers, book appointments, chat, pay, and leave reviews — all in one app.',
    },
    ar: {
      question: 'ما هي هذه المنصة؟',
      answer:
        'نربط العملاء الذين يحتاجون خدمات منزلية ومحلية بمزودي خدمات مستقلين موثوقين وفرق شركات. يمكنك تصفح الخدمات، ومقارنة العروض، وحجز المواعيد، والمراسلة، والدفع، وترك المراجعات — كل ذلك في تطبيق واحد.',
    },
  },
  {
    audience: FaqAudience.ALL,
    sortOrder: 1,
    en: {
      question: 'Which cities do you cover?',
      answer:
        'Coverage depends on active providers in your area. Enter your city when booking or updating your profile to see available services nearby. We are expanding continuously across Tunisia.',
    },
    ar: {
      question: 'ما المدن التي تغطونها؟',
      answer:
        'التغطية تعتمد على المزودين النشطين في منطقتك. أدخل مدينتك عند الحجز أو تحديث ملفك لرؤية الخدمات المتاحة قريباً منك. نوسّع تغطيتنا باستمرار في جميع أنحاء تونس.',
    },
  },
  {
    audience: FaqAudience.ALL,
    sortOrder: 2,
    en: {
      question: 'How are providers verified?',
      answer:
        'Before going live, providers submit identity and professional documents. Our admin team reviews each file. Only approved providers can receive bookings. You can also check ratings and reviews from other users.',
    },
    ar: {
      question: 'كيف يتم التحقق من مزودي الخدمات؟',
      answer:
        'قبل بدء العمل، يرسل المزودون مستندات الهوية والمؤهلات المهنية. يراجعها فريق الإدارة. فقط المزودون المعتمدون يمكنهم استقبال الحجوزات. يمكنك أيضاً الاطلاع على التقييمات والمراجعات من مستخدمين آخرين.',
    },
  },
  {
    audience: FaqAudience.ALL,
    sortOrder: 3,
    en: {
      question: 'Is my personal data safe?',
      answer:
        'We use secure authentication and encrypt sensitive data in transit. Your phone number and exact address are shared with the assigned provider only for confirmed bookings. Read our Privacy Policy for full details.',
    },
    ar: {
      question: 'هل بياناتي الشخصية آمنة؟',
      answer:
        'نستخدم مصادقة آمنة ونشفّر البيانات الحساسة أثناء النقل. يُشارك رقم هاتفك وعنوانك الدقيق مع المزود المعيّن فقط للحجوزات المؤكدة. راجع سياسة الخصوصية للتفاصيل الكاملة.',
    },
  },
  {
    audience: FaqAudience.ALL,
    sortOrder: 4,
    en: {
      question: 'How do I contact platform support?',
      answer:
        'Open Settings → Contact us, fill in your name, email, subject, and message. Our support team reads every request and responds by email. For urgent booking issues, include your appointment reference if you have one.',
    },
    ar: {
      question: 'كيف أتواصل مع دعم المنصة؟',
      answer:
        'افتح الإعدادات ← اتصل بنا، ثم أدخل اسمك وبريدك والموضوع والرسالة. يقرأ فريق الدعم كل طلب ويرد عبر البريد الإلكتروني. للمشكلات العاجلة المتعلقة بالحجز، أرفق مرجع الموعد إن وُجد.',
    },
  },

  // ── Clients ───────────────────────────────────────────────────────────────
  {
    audience: FaqAudience.CLIENT,
    sortOrder: 10,
    en: {
      question: 'How do I book a service?',
      answer:
        'Browse categories or search for a service, pick a provider or company, choose an available time slot, confirm your address, and submit the request. The provider must accept before the appointment is confirmed.',
    },
    ar: {
      question: 'كيف أحجز خدمة؟',
      answer:
        'تصفّح الفئات أو ابحث عن خدمة، اختر مزوداً أو شركة، حدّد وقتاً متاحاً، أكّد عنوانك، ثم أرسل الطلب. يجب أن يقبل المزود قبل تأكيد الموعد.',
    },
  },
  {
    audience: FaqAudience.CLIENT,
    sortOrder: 11,
    en: {
      question: 'Can I cancel or reschedule an appointment?',
      answer:
        'Yes. Open My Appointments, select the booking, and cancel if it is still pending or confirmed according to the provider\'s policy. If the provider proposes a new time, you can accept or decline from the appointment details screen.',
    },
    ar: {
      question: 'هل يمكنني إلغاء موعد أو إعادة جدولته؟',
      answer:
        'نعم. افتح مواعيدي، اختر الحجز، وألغِه إذا كان لا يزال قيد الانتظار أو مؤكداً وفق سياسة المزود. إذا اقترح المزود وقتاً جديداً، يمكنك القبول أو الرفض من شاشة تفاصيل الموعد.',
    },
  },
  {
    audience: FaqAudience.CLIENT,
    sortOrder: 12,
    en: {
      question: 'How do payments work?',
      answer:
        'Pricing is shown before you confirm (fixed price or hourly rate depending on the service). Payment methods accepted are listed on the provider\'s profile. Some providers accept cash on site; others may request bank transfer or card — confirm with your provider in chat.',
    },
    ar: {
      question: 'كيف تعمل المدفوعات؟',
      answer:
        'يظهر السعر قبل التأكيد (سعر ثابت أو بالساعة حسب الخدمة). طرق الدفع المقبولة مذكورة في ملف المزود. بعض المزودين يقبلون النقد في الموقع؛ وآخرون قد يطلبون تحويلاً بنكياً أو بطاقة — تأكد مع مزودك عبر المحادثة.',
    },
  },
  {
    audience: FaqAudience.CLIENT,
    sortOrder: 13,
    en: {
      question: 'What if the provider does not show up?',
      answer:
        'Message the provider from the appointment screen first. If you cannot reach them, cancel the booking and report the issue via Contact us or file a complaint after the scheduled time. We investigate no-show reports and may suspend repeat offenders.',
    },
    ar: {
      question: 'ماذا أفعل إذا لم يحضر المزود؟',
      answer:
        'راسل المزود من شاشة الموعد أولاً. إذا تعذّر الوصول إليه، ألغِ الحجز وأبلغ عن المشكلة عبر اتصل بنا أو قدّم شكوى بعد وقت الموعد. نحقق في بلاغات عدم الحضور وقد نعلّق حسابات المكررين.',
    },
  },
  {
    audience: FaqAudience.CLIENT,
    sortOrder: 14,
    en: {
      question: 'How do I leave a review?',
      answer:
        'After a completed appointment, open the booking and tap Leave a review. Rate the service from 1 to 5 stars and optionally add a comment. Reviews help other clients and improve provider quality on the platform.',
    },
    ar: {
      question: 'كيف أترك مراجعة؟',
      answer:
        'بعد اكتمال الموعد، افتح الحجز واضغط اترك مراجعة. قيّم الخدمة من 1 إلى 5 نجوم وأضف تعليقاً اختيارياً. المراجعات تساعد العملاء الآخرين وتحسّن جودة المزودين على المنصة.',
    },
  },
  {
    audience: FaqAudience.CLIENT,
    sortOrder: 15,
    en: {
      question: 'Can I book with a company instead of one provider?',
      answer:
        'Yes. Some services are offered by registered companies. You can book with the company and their admin assigns an available employee, or pick a specific team member when the listing allows it.',
    },
    ar: {
      question: 'هل يمكنني الحجز مع شركة بدلاً من مزود واحد؟',
      answer:
        'نعم. بعض الخدمات تقدّمها شركات مسجلة. يمكنك الحجز مع الشركة ويعيّن المسؤول موظفاً متاحاً، أو اختيار عضو محدد من الفريق عندما يسمح العرض بذلك.',
    },
  },
  {
    audience: FaqAudience.CLIENT,
    sortOrder: 16,
    en: {
      question: 'What should I prepare before the provider arrives?',
      answer:
        'Check the service description for what is included and what you must provide (access, materials, parking, etc.). Clear the work area, ensure someone can open the door, and keep pets secured if needed.',
    },
    ar: {
      question: 'ماذا أجهّز قبل وصول المزود؟',
      answer:
        'راجع وصف الخدمة لمعرفة ما يشمله العرض وما يجب أن توفره (الوصول، المواد، موقف السيارات، إلخ). نظّف منطقة العمل، وتأكد من وجود شخص لفتح الباب، وأبقِ الحيوانات الأليفة بأمان إن لزم.',
    },
  },

  // ── Providers ─────────────────────────────────────────────────────────────
  {
    audience: FaqAudience.PROVIDER,
    sortOrder: 20,
    en: {
      question: 'How do I become a provider on the platform?',
      answer:
        'Register as a provider, complete your profile, upload required verification documents, and request the services you want to offer. An admin reviews your application. Once approved, set your availability and pricing to start receiving bookings.',
    },
    ar: {
      question: 'كيف أصبح مزود خدمة على المنصة؟',
      answer:
        'سجّل كمزود خدمة، أكمل ملفك، ارفع مستندات التحقق المطلوبة، واطلب الخدمات التي تريد تقديمها. يراجع المسؤول طلبك. بعد الموافقة، حدّد توفرك وأسعارك لبدء استقبال الحجوزات.',
    },
  },
  {
    audience: FaqAudience.PROVIDER,
    sortOrder: 21,
    en: {
      question: 'How do I receive and respond to booking requests?',
      answer:
        'New requests appear in Notifications and on your calendar. Open the appointment to Accept, Refuse (with a reason), or Propose a new time. Respond quickly — fast response times improve your visibility and client trust.',
    },
    ar: {
      question: 'كيف أستقبل طلبات الحجز وأرد عليها؟',
      answer:
        'تظهر الطلبات الجديدة في الإشعارات وعلى تقويمك. افتح الموعد للقبول أو الرفض (مع سبب) أو اقتراح وقت جديد. رد بسرعة — سرعة الاستجابة تحسّن ظهورك وثقة العملاء.',
    },
  },
  {
    audience: FaqAudience.PROVIDER,
    sortOrder: 22,
    en: {
      question: 'How do I set my working hours and days off?',
      answer:
        'Go to Schedule in the sidebar. Set your weekly availability (working days and hours) and add Days off for holidays or personal leave. Clients can only book slots that match your open schedule.',
    },
    ar: {
      question: 'كيف أحدد ساعات عملي وأيام إجازتي؟',
      answer:
        'اذهب إلى الجدول من القائمة الجانبية. حدّد توفرك الأسبوعي (أيام وساعات العمل) وأضف أيام إجازة للعطل أو الظروف الشخصية. يمكن للعملاء الحجز فقط في الأوقات المفتوحة في جدولك.',
    },
  },
  {
    audience: FaqAudience.PROVIDER,
    sortOrder: 23,
    en: {
      question: 'How do I add or update a service I offer?',
      answer:
        'Open Services, request a new catalog service if needed, upload the required documents, and wait for admin approval. Then open Manage service to set price, description, gallery photos, service area, and what is included.',
    },
    ar: {
      question: 'كيف أضيف أو أحدّث خدمة أقدّمها؟',
      answer:
        'افتح الخدمات، اطلب خدمة جديدة من قائمة الخدمات إن لزم، ارفع المستندات المطلوبة، وانتظر موافقة الإدارة. ثم افتح إدارة الخدمة لتحديد السعر والوصف وصور المعرض ومنطقة الخدمة وما يشمله العرض.',
    },
  },
  {
    audience: FaqAudience.PROVIDER,
    sortOrder: 24,
    en: {
      question: 'When and how do I get paid?',
      answer:
        'Payment is agreed directly with the client based on the pricing shown on your listing (cash, transfer, etc.). The platform displays your rates; you collect payment after the job unless you arrange otherwise in chat. Payout automation may be added in future releases.',
    },
    ar: {
      question: 'متى وكيف أتقاضى أجرتي؟',
      answer:
        'يُتفق على الدفع مباشرة مع العميل وفق الأسعار المعروضة في قائمتك (نقد، تحويل، إلخ). تعرض المنصة أسعارك؛ تحصّل المبلغ بعد إنجاز العمل ما لم ترتبوا خلاف ذلك عبر المحادثة. قد تُضاف آليات دفع آلية في إصدارات لاحقة.',
    },
  },
  {
    audience: FaqAudience.PROVIDER,
    sortOrder: 25,
    en: {
      question: 'What happens if a client cancels?',
      answer:
        'You receive a notification when a client cancels. The slot becomes available again on your calendar. For repeated last-minute cancellations, you may report the client through the complaint flow after the appointment date.',
    },
    ar: {
      question: 'ماذا يحدث إذا ألغى العميل الموعد؟',
      answer:
        'تصلك إشعار عند إلغاء العميل. يصبح الموعد متاحاً مجدداً في تقويمك. للإلغاءات المتكررة في اللحظة الأخيرة، يمكنك الإبلاغ عن العميل عبر مسار الشكاوى بعد تاريخ الموعد.',
    },
  },
  {
    audience: FaqAudience.PROVIDER,
    sortOrder: 26,
    en: {
      question: 'How do ratings and reviews affect my profile?',
      answer:
        'Your average rating and review count appear on your public profile. High ratings improve trust and booking conversion. You can reply publicly to client reviews from the My reviews section to clarify or thank clients.',
    },
    ar: {
      question: 'كيف تؤثر التقييمات والمراجعات على ملفي؟',
      answer:
        'يظهر متوسط تقييمك وعدد المراجعات في ملفك العام. التقييمات العالية تعزز الثقة ومعدل الحجز. يمكنك الرد علناً على مراجعات العملاء من قسم مراجعاتي للتوضيح أو الشكر.',
    },
  },
  {
    audience: FaqAudience.PROVIDER,
    sortOrder: 27,
    en: {
      question: 'Can I join a company as an employee provider?',
      answer:
        'Yes. When a company invites you, open Invitations in the sidebar to Accept or Decline. Once you join, the company admin may assign you to jobs and manage part of your schedule depending on company settings.',
    },
    ar: {
      question: 'هل يمكنني الانضمام إلى شركة كموظف مزود؟',
      answer:
        'نعم. عند دعوتك من شركة، افتح الدعوات من القائمة الجانبية للقبول أو الرفض. بعد الانضمام، قد يعيّنك مسؤول الشركة للمهام ويدير جزءاً من جدولك حسب إعدادات الشركة.',
    },
  },
  {
    audience: FaqAudience.PROVIDER,
    sortOrder: 28,
    en: {
      question: 'What should I do when I arrive at a job?',
      answer:
        'Use the appointment execution flow: mark En route when leaving, Start when work begins (client may confirm), and End when finished. This keeps the client informed and protects both sides if a dispute arises.',
    },
    ar: {
      question: 'ماذا أفعل عند وصولي إلى موقع العمل؟',
      answer:
        'استخدم مسار تنفيذ الموعد: علّم في الطريق عند المغادرة، وابدأ عند بدء العمل (قد يؤكد العميل)، وأنهِ عند الانتهاء. هذا يُبقي العميل على اطلاع ويحمي الطرفين إذا نشأ نزاع.',
    },
  },
];

async function main() {
  console.log('Seeding FAQ items…');

  const deletedTranslations = await prisma.faqTranslation.deleteMany();
  const deletedItems = await prisma.faqItem.deleteMany();
  console.log(
    `Cleared ${deletedItems.count} FAQ item(s) and ${deletedTranslations.count} translation(s).`,
  );

  let created = 0;
  for (const row of FAQ_ITEMS) {
    await prisma.faqItem.create({
      data: {
        audience: row.audience,
        sortOrder: row.sortOrder,
        isPublished: true,
        translations: {
          create: [
            {
              locale: Locale.EN,
              question: row.en.question,
              answer: row.en.answer,
            },
            {
              locale: Locale.AR,
              question: row.ar.question,
              answer: row.ar.answer,
            },
          ],
        },
      },
    });
    created += 1;
  }

  const byAudience = FAQ_ITEMS.reduce(
    (acc, row) => {
      acc[row.audience] = (acc[row.audience] ?? 0) + 1;
      return acc;
    },
    {} as Record<FaqAudience, number>,
  );

  console.log(`Created ${created} FAQ item(s):`);
  console.log(`  ALL: ${byAudience.ALL ?? 0}`);
  console.log(`  CLIENT: ${byAudience.CLIENT ?? 0}`);
  console.log(`  PROVIDER: ${byAudience.PROVIDER ?? 0}`);
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
