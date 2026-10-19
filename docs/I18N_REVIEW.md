# Arabic copy that needs native review

140 Arabic strings were written by the assistant, not a native copywriter. Review tone, terminology (Egyptian retail wording, for
example the category names) and plural forms. Brand and model names left in Latin (AMD Ryzen, DDR5, ...) are not listed.
The owner plans one native-review pass once more copy exists.

This file is GENERATED from `messages/ar.json`, `src/config/brand.ts` and the category tree. Do not edit it by hand:
run `npm run i18n:review` after adding strings (CI runs `npm run i18n:review:check`).

<!-- prettier-ignore-start -->

## UI messages

| Where | English | Arabic (machine-written) |
| --- | --- | --- |
| messages: Common.skipToContent | Skip to main content | انتقل إلى المحتوى الرئيسي |
| messages: Common.language | Language | اللغة |
| messages: Common.theme | Theme | المظهر |
| messages: Common.themeLight | Light | فاتح |
| messages: Common.themeDark | Dark | داكن |
| messages: Common.themeSystem | System | حسب النظام |
| messages: Common.backToHome | Back to home | العودة إلى الرئيسية |
| messages: Common.tryAgain | Try again | حاول مرة أخرى |
| messages: Home.lead | {tagline} | {tagline} |
| messages: Home.status | {brand} is under construction. The catalog and checkout are coming soon. | {brand} قيد الإنشاء. الكتالوج والدفع قادمان قريبًا. |
| messages: NotFound.title | Page not found | الصفحة غير موجودة |
| messages: NotFound.body | That page doesn’t exist or has moved. | هذه الصفحة غير موجودة أو تم نقلها. |
| messages: Error.title | Something went wrong | حدث خطأ ما |
| messages: Error.body | The page failed to load. Try again, and contact us if it keeps happening. | تعذّر تحميل الصفحة. حاول مرة أخرى، وتواصل معنا إذا استمرت المشكلة. |
| messages: Styleguide.title | Style guide | دليل الأسلوب |
| messages: Styleguide.intro | Development reference for the {brand} design system. Not indexed and hidden in production. | مرجع التطوير لنظام تصميم {brand}. غير مفهرس ومخفي في الإنتاج. |
| messages: Styleguide.colors | Color tokens | ألوان التصميم |
| messages: Styleguide.type | Type | الخطوط |
| messages: Styleguide.typeSample | Graphics cards, memory and storage | كروت الشاشة والذاكرة والتخزين |
| messages: Styleguide.controls | Controls | عناصر التحكم |
| messages: Styleguide.primaryAction | Add to cart | أضف إلى السلة |
| messages: Styleguide.secondaryAction | Compare | قارن |
| messages: Styleguide.link | Read the delivery policy | اقرأ سياسة التوصيل |
| messages: Styleguide.fieldLabel | Email address | البريد الإلكتروني |
| messages: Styleguide.fieldHint | We only use it for order updates. | نستخدمه فقط لتحديثات الطلب. |
| messages: Nav.menu | Menu | القائمة |
| messages: Nav.closeMenu | Close menu | إغلاق القائمة |
| messages: Nav.categories | Product categories | فئات المنتجات |
| messages: Nav.mobileTitle | Browse the store | تصفح المتجر |
| messages: Nav.mobileDescription | Browse all product categories and manage your preferences. | تصفح جميع فئات المنتجات وأدر تفضيلاتك. |
| messages: Nav.shopAll | Shop all {name} | عرض كل {name} |
| messages: Nav.deals | Deals | العروض |
| messages: Nav.searchLabel | Search the store | ابحث في المتجر |
| messages: Nav.searchPlaceholder | Search CPUs, GPUs, SSDs… | ابحث عن معالجات، كروت شاشة، SSD… |
| messages: Nav.searchSubmit | Search | بحث |
| messages: Nav.account | Account | الحساب |
| messages: Nav.signIn | Sign in | تسجيل الدخول |
| messages: Nav.wishlist | Wishlist | المفضلة |
| messages: Nav.cart | Cart | السلة |
| messages: Nav.cartCount | {count, plural, =0 {Cart, empty} one {Cart, # item} other {Cart, # items}} | {count, plural, =0 {السلة فارغة} one {السلة، منتج واحد} two {السلة، منتجان} few {السلة، # منتجات} many {السلة، # منتجًا} other {السلة، # منتج}} |
| messages: Nav.support | Help & support | المساعدة والدعم |
| messages: Nav.callUs | Call us | اتصل بنا |
| messages: Nav.utility | Account and help | الحساب والمساعدة |
| messages: Nav.preferences | Preferences | التفضيلات |
| messages: Routes.search | Search | البحث |
| messages: Routes.cart | Cart | السلة |
| messages: Routes.wishlist | Wishlist | المفضلة |
| messages: Routes.account | My account | حسابي |
| messages: Routes.compare | Compare | المقارنة |
| messages: Routes.deals | Deals | العروض |
| messages: Routes.contact | Contact us | اتصل بنا |
| messages: Routes.about | About us | من نحن |
| messages: Routes.faq | FAQ | الأسئلة الشائعة |
| messages: Routes.shipping | Shipping and delivery | الشحن والتوصيل |
| messages: Routes.returns | Returns and refunds | الإرجاع والاسترداد |
| messages: Routes.warranty | Warranty | الضمان |
| messages: Routes.terms | Terms and conditions | الشروط والأحكام |
| messages: Routes.privacy | Privacy policy | سياسة الخصوصية |
| messages: Routes.cookies | Cookie policy | سياسة ملفات الارتباط |
| messages: Routes.branches | Branches | الفروع |
| messages: Routes.status | System status | حالة النظام |
| messages: ComingSoon.body | This page is coming soon. We’re still getting it ready. | هذه الصفحة قادمة قريبًا. ما زلنا نجهزها. |
| messages: ComingSoon.categoryBody | We’re stocking this category. Check back soon. | نجهز منتجات هذه الفئة. عد قريبًا. |
| messages: Breadcrumb.label | Breadcrumb | مسار التنقل |
| messages: Breadcrumb.home | Home | الرئيسية |
| messages: Footer.shop | Shop | تسوق |
| messages: Footer.customerCare | Customer care | خدمة العملاء |
| messages: Footer.company | Company | الشركة |
| messages: Footer.contact | Contact | تواصل معنا |
| messages: Footer.followUs | Follow us | تابعنا |
| messages: Footer.payments | Payment methods | طرق الدفع |
| messages: Footer.payCod | Cash on Delivery | الدفع عند الاستلام |
| messages: Footer.payCard | Debit and credit cards | بطاقات الخصم والائتمان |
| messages: Footer.rights | All rights reserved. | جميع الحقوق محفوظة. |
| messages: Footer.cookieSettings | Cookie settings | إعدادات ملفات الارتباط |
| messages: Footer.email | Email | البريد الإلكتروني |
| messages: Footer.phone | Phone | الهاتف |
| messages: Footer.whatsapp | WhatsApp | واتساب |
| messages: Footer.address | Address | العنوان |
| messages: Footer.copyright | © {year} {brand}. | © {year} {brand}. |
| messages: Status.label | System status | حالة النظام |
| messages: Status.checking | Checking status… | جارٍ فحص الحالة… |
| messages: Status.operational | All systems operational | جميع الأنظمة تعمل |
| messages: Status.degraded | Some systems are degraded | بعض الأنظمة تعمل بأداء منخفض |
| messages: Status.down | Service disruption | انقطاع في الخدمة |
| messages: Status.unavailable | Status unavailable | الحالة غير متاحة |
| messages: Cookies.title | Your privacy choices | خياراتك للخصوصية |
| messages: Cookies.body | We use essential cookies and storage to run the store (language, theme, cart). With your permission we also use analytics to improve it. Read our <link>cookie policy</link>. | نستخدم ملفات ارتباط وتخزينًا أساسيًا لتشغيل المتجر (اللغة والمظهر والسلة). وبموافقتك نستخدم أيضًا التحليلات لتحسينه. اقرأ <link>سياسة ملفات الارتباط</link>. |
| messages: Cookies.acceptAll | Accept all | قبول الكل |
| messages: Cookies.reject | Reject non-essential | رفض غير الضروري |
| messages: Cookies.customize | Customize | تخصيص |
| messages: Cookies.save | Save choices | حفظ الاختيارات |
| messages: Cookies.essentialTitle | Essential | أساسية |
| messages: Cookies.essentialDesc | Needed for the store to work. Always on. | مطلوبة لعمل المتجر. مفعّلة دائمًا. |
| messages: Cookies.analyticsTitle | Analytics | التحليلات |
| messages: Cookies.analyticsDesc | Helps us understand how the store is used. Off unless you allow it. | تساعدنا على فهم كيفية استخدام المتجر. متوقفة ما لم توافق. |
| messages: Cookies.close | Close | إغلاق |

## Brand copy

| Where | English | Arabic (machine-written) |
| --- | --- | --- |
| brand: tagline | PC hardware, delivered across Egypt. | قطع الكمبيوتر وملحقاته، توصيل لجميع أنحاء مصر. |
| brand: seo.title | PC hardware store in Egypt | متجر قطع الكمبيوتر في مصر |
| brand: seo.description | Shop CPUs, graphics cards, motherboards, memory, storage and ready-built gaming PCs, with Cash on Delivery across Egypt. | تسوّق المعالجات وكروت الشاشة واللوحات الأم والذاكرة والتخزين وأجهزة الألعاب الجاهزة مع الدفع عند الاستلام في جميع أنحاء مصر. |

## Category names (temporary static tree; moves to the database in M3a)

| Where | English | Arabic (machine-written) |
| --- | --- | --- |
| category: components | Components | المكونات |
| category: components/cpus | CPUs | المعالجات |
| category: components/graphics-cards | Graphics Cards | كروت الشاشة |
| category: components/motherboards | Motherboards | اللوحات الأم |
| category: components/motherboards/amd-motherboards | AMD Motherboards | لوحات AMD الأم |
| category: components/motherboards/intel-motherboards | Intel Motherboards | لوحات Intel الأم |
| category: components/memory | Memory (RAM) | الذاكرة العشوائية |
| category: components/storage | Storage | وحدات التخزين |
| category: components/storage/nvme-ssds | NVMe SSDs | أقراص NVMe |
| category: components/storage/sata-ssds | SATA SSDs | أقراص SATA |
| category: components/storage/hard-drives | Hard Drives | الأقراص الصلبة |
| category: components/power-supplies | Power Supplies | مصادر الطاقة |
| category: components/cases | Cases | صناديق الكمبيوتر |
| category: components/cooling | Cooling | التبريد |
| category: components/cooling/air-coolers | Air Coolers | مبردات هوائية |
| category: components/cooling/liquid-coolers | Liquid Coolers | مبردات مائية |
| category: components/cooling/case-fans | Case Fans | مراوح الصندوق |
| category: pc-bundles | PC Bundles | تجميعات الكمبيوتر |
| category: pc-bundles/gaming-pcs | Gaming PCs | أجهزة الألعاب |
| category: pc-bundles/workstations | Workstations | محطات العمل |
| category: pc-bundles/office-pcs | Office PCs | أجهزة المكتب |
| category: pc-bundles/budget-builds | Budget Builds | تجميعات اقتصادية |
| category: laptops | Laptops | اللابتوب |
| category: laptops/gaming-laptops | Gaming Laptops | لابتوب الألعاب |
| category: laptops/ultrabooks | Ultrabooks | ألترابوك |
| category: laptops/business-laptops | Business Laptops | لابتوب الأعمال |
| category: monitors | Monitors | الشاشات |
| category: monitors/gaming-monitors | Gaming Monitors | شاشات الألعاب |
| category: monitors/ultrawide-monitors | Ultrawide Monitors | شاشات عريضة |
| category: monitors/office-monitors | Office Monitors | شاشات المكتب |
| category: monitors/4k-monitors | 4K Monitors | شاشات 4K |
| category: peripherals | Peripherals | الملحقات الطرفية |
| category: peripherals/keyboards | Keyboards | لوحات المفاتيح |
| category: peripherals/mice | Mice | الفأرات |
| category: peripherals/headsets | Headsets | سماعات الرأس |
| category: peripherals/webcams | Webcams | كاميرات الويب |
| category: networking | Networking | الشبكات |
| category: networking/routers | Routers | الراوترات |
| category: networking/wifi-adapters | Wi-Fi Adapters | كروت الواي فاي |
| category: networking/network-switches | Network Switches | سويتشات الشبكة |

<!-- prettier-ignore-end -->
