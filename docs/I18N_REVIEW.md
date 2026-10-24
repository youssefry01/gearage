# Arabic copy that needs native review

638 Arabic strings were written by the assistant, not a native copywriter. Review tone, terminology (Egyptian retail wording, for
example the category names) and plural forms. Brand and model names left in Latin (AMD Ryzen, DDR5, ...) are not listed.
The owner plans one native-review pass once more copy exists.

This file is GENERATED from `messages/ar.json`, `src/config/brand.ts`, the category tree and the seed data files (`prisma/seed/data`). Do not edit it by hand:
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
| messages: Listing.resultCount | {count, plural, one {# product} other {# products}} | {count, plural, zero {لا توجد منتجات} one {منتج واحد} two {منتجان} few {# منتجات} many {# منتجًا} other {# منتج}} |
| messages: Listing.sortLabel | Sort by | ترتيب حسب |
| messages: Listing.sort.popular | Most popular | الأكثر رواجًا |
| messages: Listing.sort.best-selling | Best selling | الأكثر مبيعًا |
| messages: Listing.sort.newest | Newest | الأحدث |
| messages: Listing.sort.price-asc | Price: low to high | السعر: من الأقل إلى الأعلى |
| messages: Listing.sort.price-desc | Price: high to low | السعر: من الأعلى إلى الأقل |
| messages: Listing.sort.discount | Biggest discount | أكبر خصم |
| messages: Listing.filters | Filters | تصفية |
| messages: Listing.filtersWithCount | Filters ({count}) | تصفية ({count}) |
| messages: Listing.filtersTitle | Filter products | تصفية المنتجات |
| messages: Listing.filtersDescription | Narrow the products in this category. | قلّل المنتجات المعروضة في هذا القسم. |
| messages: Listing.clearAll | Clear all filters | مسح كل المرشحات |
| messages: Listing.showResults | Show results | عرض النتائج |
| messages: Listing.close | Close filters | إغلاق التصفية |
| messages: Listing.activeFilters | Active filters | المرشحات المفعّلة |
| messages: Listing.removeFilter | Remove filter: {label} | إزالة المرشح: {label} |
| messages: Listing.priceChip | {min} – {max} | {min} – {max} |
| messages: Listing.priceFrom | From {min} | من {min} |
| messages: Listing.priceUpTo | Up to {max} | حتى {max} |
| messages: Listing.noResultsTitle | No products match your filters | لا توجد منتجات تطابق المرشحات |
| messages: Listing.noResultsBody | Try removing a filter or two, or clear them all to see everything in this category. | جرّب إزالة مرشح أو اثنين، أو امسحها جميعًا لعرض كل منتجات هذا القسم. |
| messages: Listing.clearFilters | Clear filters | مسح المرشحات |
| messages: Listing.pageSuffix | Page {page} | صفحة {page} |
| messages: Listing.metaDescription | Browse {category} at {store}. | تصفح {category} في {store}. |
| messages: Listing.demoNotice | Demo catalog: prices, discounts, stock levels and specifications are illustrative samples, not live offers. | كتالوج تجريبي: الأسعار والخصومات ومستويات المخزون والمواصفات المعروضة أمثلة توضيحية وليست عروضًا فعلية. |
| messages: Listing.productsHeading | Products | المنتجات |
| messages: Listing.subcategories | Browse subcategories | تصفح الأقسام الفرعية |
| messages: Filters.brand | Brand | العلامة التجارية |
| messages: Filters.tags | Tags | الوسوم |
| messages: Filters.price | Price (EGP) | السعر (جنيه) |
| messages: Filters.priceMin | Min | الأدنى |
| messages: Filters.priceMax | Max | الأعلى |
| messages: Filters.availability | Availability | التوفر |
| messages: Filters.inStock | In stock only | المتوفر فقط |
| messages: Filters.onSale | On sale | عليه خصم |
| messages: Filters.rangeFrom | From | من |
| messages: Filters.rangeTo | To | إلى |
| messages: Filters.rangeBetween | Available range: {min} to {max} | النطاق المتاح: من {min} إلى {max} |
| messages: ProductCard.bundle | PC bundle | تجميعة كمبيوتر |
| messages: ProductCard.parts | {count, plural, one {# part} other {# parts}} | {count, plural, zero {بدون قطع} one {قطعة واحدة} two {قطعتان} few {# قطع} many {# قطعة} other {# قطعة}} |
| messages: ProductCard.youSave | You save {amount} | توفّر {amount} |
| messages: ProductCard.vsParts | vs. buying the parts separately | مقارنةً بشراء القطع منفصلة |
| messages: ProductCard.wasPrice | Was {price} | كان {price} |
| messages: ProductCard.currentPrice | Price | السعر |
| messages: ProductCard.percentOff | {percent}% off | خصم {percent}٪ |
| messages: ProductCard.inStock | In stock | متوفر |
| messages: ProductCard.lowStock | Only {count} left | متبقي {count} فقط |
| messages: ProductCard.outOfStock | Out of stock | غير متوفر |
| messages: ProductCard.noImage | No image available | لا توجد صورة |
| messages: Pagination.label | Pagination | ترقيم الصفحات |
| messages: Pagination.previous | Previous | السابق |
| messages: Pagination.next | Next | التالي |
| messages: Pagination.goToPage | Go to page {page} | انتقل إلى الصفحة {page} |
| messages: Pagination.currentPage | Page {page}, current page | الصفحة {page}، الصفحة الحالية |
| messages: Pagination.status | Page {page} of {pages} | الصفحة {page} من {pages} |
| messages: Product.galleryLabel | Product images | صور المنتج |
| messages: Product.showImage | Show image {number} of {total} | عرض الصورة {number} من {total} |
| messages: Product.enlarge | Enlarge image | تكبير الصورة |
| messages: Product.viewerTitle | Images of {title} | صور {title} |
| messages: Product.viewerDescription | Use the arrow keys or the buttons to move between images. Press Escape to close. | استخدم مفاتيح الأسهم أو الأزرار للتنقل بين الصور. اضغط Escape للإغلاق. |
| messages: Product.imageCounter | Image {current} of {total} | الصورة {current} من {total} |
| messages: Product.previous | Previous image | الصورة السابقة |
| messages: Product.next | Next image | الصورة التالية |
| messages: Product.close | Close | إغلاق |
| messages: Product.brand | Brand | العلامة التجارية |
| messages: Product.sku | SKU | رمز المنتج (SKU) |
| messages: Product.mpn | Part number (MPN) | رقم القطعة (MPN) |
| messages: Product.model | Model | الموديل |
| messages: Product.condition | Condition | الحالة |
| messages: Product.conditionNEW | New | جديد |
| messages: Product.conditionREFURBISHED | Refurbished | مجدَّد |
| messages: Product.warranty | {months, plural, one {# month warranty} other {# months warranty}} | {months, plural, one {ضمان شهر واحد} two {ضمان شهرين} few {ضمان # أشهر} many {ضمان # شهرًا} other {ضمان # شهر}} |
| messages: Product.warrantyLabel | Warranty | الضمان |
| messages: Product.weight | Weight | الوزن |
| messages: Product.dimensions | Dimensions (L × W × H) | الأبعاد (الطول × العرض × الارتفاع) |
| messages: Product.kilograms | {value} kg | {value} كجم |
| messages: Product.grams | {value} g | {value} جم |
| messages: Product.millimetres | {length} × {width} × {height} mm | {length} × {width} × {height} مم |
| messages: Product.quantity | Quantity | الكمية |
| messages: Product.addToCart | Add to cart | أضف إلى السلة |
| messages: Product.unavailable | Currently unavailable | غير متاح حاليًا |
| messages: Product.addedToCart | {count, plural, one {# item added to your cart} other {# items added to your cart}} | {count, plural, one {تمت إضافة منتج واحد إلى سلتك} two {تمت إضافة منتجين إلى سلتك} few {تمت إضافة # منتجات إلى سلتك} many {تمت إضافة # منتجًا إلى سلتك} other {تمت إضافة # منتج إلى سلتك}} |
| messages: Product.viewCart | View cart | عرض السلة |
| messages: Product.maxPerOrder | Up to {max} per order | حتى {max} في الطلب الواحد |
| messages: Product.deliveryTitle | Delivery | التوصيل |
| messages: Product.deliveryBody | We deliver across Egypt. The delivery fee and estimated time depend on your governorate and are shown at checkout. | نوصّل إلى جميع أنحاء مصر. تعتمد رسوم التوصيل والمدة المتوقعة على محافظتك وتظهر عند إتمام الطلب. |
| messages: Product.overview | Overview | نظرة عامة |
| messages: Product.description | Description | الوصف |
| messages: Product.specifications | Specifications | المواصفات |
| messages: Product.general | General | معلومات عامة |
| messages: Product.yes | Yes | نعم |
| messages: Product.no | No | لا |
| messages: Product.tags | Tags | الوسوم |
| messages: Product.showcaseTitle | From the manufacturer | من الشركة المصنّعة |
| messages: Product.showcaseSource | Source: {credit} | المصدر: {credit} |
| messages: Product.videoTitle | Product video | فيديو المنتج |
| messages: Product.videoPlay | Play video | تشغيل الفيديو |
| messages: Product.videoNote | The video loads from YouTube (privacy-enhanced mode) only after you press play. | لا يتم تحميل الفيديو من يوتيوب (وضع الخصوصية المحسّن) إلا بعد الضغط على التشغيل. |
| messages: Product.relatedTitle | You may also like | قد يعجبك أيضًا |
| messages: Product.includedInTitle | Included in these bundles | متوفر ضمن هذه التجميعات |
| messages: Product.bundleSummaryTitle | At a glance | نظرة سريعة |
| messages: Product.bundleMemory | Memory | الذاكرة |
| messages: Product.bundleStorage | Storage | التخزين |
| messages: Product.bundlePsu | Power supply | مزود الطاقة |
| messages: Product.bundleEstimatedDraw | Estimated power draw | استهلاك الطاقة التقديري |
| messages: Product.bundleRecommendedPsu | Recommended power supply | مزود الطاقة الموصى به |
| messages: Product.watts | {value} W | {value} واط |
| messages: Product.gigabytes | {value} GB | {value} جيجابايت |
| messages: Product.terabytes | {value} TB | {value} تيرابايت |
| messages: Product.bundlePartsTitle | What's included | محتويات التجميعة |
| messages: Product.bundlePartsCaption | Parts included in this bundle | القطع المضمّنة في هذه التجميعة |
| messages: Product.colPart | Part | القطعة |
| messages: Product.colQuantity | Qty | الكمية |
| messages: Product.colUnitPrice | Unit price | سعر الوحدة |
| messages: Product.colTotal | Total | الإجمالي |
| messages: Product.colStock | Availability | التوفر |
| messages: Product.partsTotal | Parts bought separately | سعر القطع منفصلة |
| messages: Product.bundlePrice | Bundle price | سعر التجميعة |
| messages: Product.partShort | Not enough in stock | المخزون غير كافٍ |
| messages: Product.partUnavailable | No longer sold | لم تعد متاحة للبيع |
| messages: Product.partOk | In stock | متوفر |
| messages: Product.bundleUnavailableNote | This bundle can't be ordered right now because at least one of its parts is out of stock or no longer sold. | لا يمكن طلب هذه التجميعة حاليًا لأن إحدى قطعها على الأقل غير متوفرة أو لم تعد متاحة للبيع. |
| messages: Product.viewPart | View {title} | عرض {title} |
| messages: Product.perBundle | × {count} | × {count} |
| messages: Product.cartMax | You already have the maximum of {max} in your cart. | لديك بالفعل الحد الأقصى ({max}) في سلتك. |
| messages: Product.saving | You save | توفّر |
| messages: Compatibility.ok | All parts verified compatible | تم التحقق من توافق جميع القطع |
| messages: Compatibility.notes | Compatible, with notes | متوافقة مع ملاحظات |
| messages: Compatibility.problem | Compatibility problem | مشكلة في التوافق |
| messages: Compatibility.heading | Compatibility check | فحص التوافق |
| messages: Compatibility.intro | Checked automatically from the parts' specifications. | يتم الفحص تلقائيًا من مواصفات القطع. |
| messages: Compatibility.cpuSocketMismatch | The {cpu} processor does not fit the {motherboard} motherboard socket. | المعالج {cpu} لا يتناسب مع مقبس اللوحة الأم {motherboard}. |
| messages: Compatibility.ramTypeMismatch | {ram} memory is not supported by this {motherboard} motherboard. | ذاكرة {ram} غير مدعومة في اللوحة الأم {motherboard}. |
| messages: Compatibility.ramSlotsExceeded | {modules} memory modules do not fit in {slots} slots. | لا يمكن تركيب {modules} وحدات ذاكرة في {slots} منافذ. |
| messages: Compatibility.ramCapacityExceeded | {gb} GB of memory exceeds the motherboard maximum of {maxGb} GB. | سعة الذاكرة {gb} جيجابايت تتجاوز الحد الأقصى للوحة الأم وهو {maxGb} جيجابايت. |
| messages: Compatibility.caseFormFactorUnsupported | This case does not support a {motherboard} motherboard (supports: {supported}). | هذا الصندوق لا يدعم لوحة أم بمقاس {motherboard} (المدعوم: {supported}). |
| messages: Compatibility.gpuTooLong | The graphics card ({gpuMm} mm) is longer than the case allows ({maxMm} mm). | كارت الشاشة ({gpuMm} مم) أطول مما يسمح به الصندوق ({maxMm} مم). |
| messages: Compatibility.coolerSocketUnsupported | The CPU cooler does not support the {cpu} socket. | مبرّد المعالج لا يدعم مقبس {cpu}. |
| messages: Compatibility.radiatorUnsupported | The case does not support a {radiatorMm} mm radiator. | الصندوق لا يدعم مشعّ تبريد بطول {radiatorMm} مم. |
| messages: Compatibility.coolerTooTall | The CPU cooler ({coolerMm} mm) is taller than the case allows ({maxMm} mm). | مبرّد المعالج ({coolerMm} مم) أطول مما يسمح به الصندوق ({maxMm} مم). |
| messages: Compatibility.coolerUnderRated | The CPU cooler is rated for {ratingW} W, below the processor's {cpuW} W. | مبرّد المعالج مصنَّف لـ {ratingW} واط، أقل من {cpuW} واط للمعالج. |
| messages: Compatibility.psuFormFactorUnsupported | The case does not support a {psu} power supply. | الصندوق لا يدعم مزود طاقة بمقاس {psu}. |
| messages: Compatibility.psuInsufficient | The {psuW} W power supply is below the estimated {estimatedW} W draw. | مزود الطاقة {psuW} واط أقل من الاستهلاك التقديري {estimatedW} واط. |
| messages: Compatibility.psuBelowRecommended | The {psuW} W power supply is below the recommended {recommendedW} W. | مزود الطاقة {psuW} واط أقل من الموصى به {recommendedW} واط. |
| messages: Compatibility.m2SlotsExceeded | {drives} M.2 drives do not fit in {slots} motherboard slots. | لا يمكن تركيب {drives} أقراص M.2 في {slots} منافذ على اللوحة الأم. |
| messages: Compatibility.unknownSpec | Could not verify one check because the specification "{spec}" is missing. | تعذّر التحقق من أحد الفحوصات لأن المواصفة "{spec}" غير متوفرة. |

## Brand copy

| Where | English | Arabic (machine-written) |
| --- | --- | --- |
| brand: tagline | PC hardware, delivered across Egypt. | قطع الكمبيوتر وملحقاته، توصيل لجميع أنحاء مصر. |
| brand: seo.title | PC hardware store in Egypt | متجر قطع الكمبيوتر في مصر |
| brand: seo.description | Shop CPUs, graphics cards, motherboards, memory, storage and ready-built gaming PCs, with Cash on Delivery across Egypt. | تسوّق المعالجات وكروت الشاشة واللوحات الأم والذاكرة والتخزين وأجهزة الألعاب الجاهزة مع الدفع عند الاستلام في جميع أنحاء مصر. |

## Category names (temporary static tree; moves to the database in M3a)

| Where | English | Arabic (machine-written) |
| --- | --- | --- |

## Seed catalog: category names, descriptions and tags

| Where | English | Arabic (machine-written) |
| --- | --- | --- |
| seed category: components | Components | المكونات |
| seed category: components/cpus | CPUs | المعالجات |
| seed category: components/graphics-cards | Graphics Cards | كروت الشاشة |
| seed category: components/motherboards | Motherboards | اللوحات الأم |
| seed category: components/motherboards/amd-motherboards | AMD Motherboards | لوحات AMD الأم |
| seed category: components/motherboards/intel-motherboards | Intel Motherboards | لوحات Intel الأم |
| seed category: components/memory | Memory (RAM) | الذاكرة العشوائية |
| seed category: components/storage | Storage | وحدات التخزين |
| seed category: components/storage/nvme-ssds | NVMe SSDs | أقراص NVMe |
| seed category: components/storage/sata-ssds | SATA SSDs | أقراص SATA |
| seed category: components/storage/hard-drives | Hard Drives | الأقراص الصلبة |
| seed category: components/power-supplies | Power Supplies | مصادر الطاقة |
| seed category: components/cases | Cases | صناديق الكمبيوتر |
| seed category: components/cooling | Cooling | التبريد |
| seed category: components/cooling/air-coolers | Air Coolers | مبردات هوائية |
| seed category: components/cooling/liquid-coolers | Liquid Coolers | مبردات مائية |
| seed category: components/cooling/case-fans | Case Fans | مراوح الصندوق |
| seed category: pc-bundles | PC Bundles | تجميعات الكمبيوتر |
| seed category: pc-bundles/gaming-pcs | Gaming PCs | أجهزة الألعاب |
| seed category: pc-bundles/workstations | Workstations | محطات العمل |
| seed category: pc-bundles/office-pcs | Office PCs | أجهزة المكتب |
| seed category: pc-bundles/budget-builds | Budget Builds | تجميعات اقتصادية |
| seed category: laptops | Laptops | اللابتوب |
| seed category: laptops/gaming-laptops | Gaming Laptops | لابتوب الألعاب |
| seed category: laptops/ultrabooks | Ultrabooks | ألترابوك |
| seed category: laptops/business-laptops | Business Laptops | لابتوب الأعمال |
| seed category: monitors | Monitors | الشاشات |
| seed category: monitors/gaming-monitors | Gaming Monitors | شاشات الألعاب |
| seed category: monitors/ultrawide-monitors | Ultrawide Monitors | شاشات عريضة |
| seed category: monitors/office-monitors | Office Monitors | شاشات المكتب |
| seed category: monitors/4k-monitors | 4K Monitors | شاشات 4K |
| seed category: peripherals | Peripherals | الملحقات الطرفية |
| seed category: peripherals/keyboards | Keyboards | لوحات المفاتيح |
| seed category: peripherals/mice | Mice | الفأرات |
| seed category: peripherals/headsets | Headsets | سماعات الرأس |
| seed category: peripherals/webcams | Webcams | كاميرات الويب |
| seed category: networking | Networking | الشبكات |
| seed category: networking/routers | Routers | الراوترات |
| seed category: networking/wifi-adapters | Wi-Fi Adapters | كروت الواي فاي |
| seed category: networking/network-switches | Network Switches | سويتشات الشبكة |
| seed category: audio-streaming | Audio & Streaming | الصوتيات والبث |
| seed category: audio-streaming/microphones | Microphones | الميكروفونات |
| seed category: accessories | Accessories | الإكسسوارات |
| seed category: accessories/thermal-paste | Thermal Paste | معجون حراري |
| seed category: accessories/mouse-pads | Mouse Pads | ماوس باد |
| seed category: gift-cards | Gift Cards | بطاقات الهدايا |
| seed category description: components | Everything inside the PC: processors, graphics cards, motherboards, memory, storage, power, cases and cooling. | كل ما بداخل الكمبيوتر: المعالجات وكروت الشاشة واللوحات الأم والذاكرة والتخزين والطاقة والصناديق والتبريد. |
| seed category description: pc-bundles | Curated sets of compatible parts sold together at one price. | مجموعات مختارة من القطع المتوافقة تُباع معاً بسعر واحد. |
| tag: featured | Featured | مميز |
| tag: gaming | Gaming | ألعاب |
| tag: budget | Budget | اقتصادي |
| tag: high-end | High-end | فئة عليا |
| tag: workstation | Workstation | محطات عمل |
| tag: creator | Content creation | صناعة المحتوى |
| tag: office | Office | مكتبي |
| tag: streaming | Streaming | بث |
| tag: rgb | RGB | إضاءة RGB |
| tag: wireless | Wireless | لاسلكي |
| tag: quiet | Quiet | هادئ |
| tag: compact | Compact | صغير الحجم |
| tag: wifi | Wi-Fi | واي فاي |
| tag: previous-gen | Previous generation | الجيل السابق |

## Seed catalog: spec labels and options

| Where | English | Arabic (machine-written) |
| --- | --- | --- |
| spec label | Socket | المقبس |
| spec label | Cores | عدد الأنوية |
| spec label | Threads | عدد الخيوط |
| spec label | Base clock (P-core) | السرعة الأساسية |
| spec label | Max boost clock | أقصى سرعة |
| spec label | TDP | الطاقة الحرارية TDP |
| spec label | Cache (L3 / Smart Cache) | الذاكرة المخبأة |
| spec label | Integrated graphics | رسوميات مدمجة |
| spec label | Cooler included in the box | المبرد مرفق بالعلبة |
| spec label | Architecture | المعمارية |
| spec label | Supported memory | الذاكرة المدعومة |
| spec label | GPU maker | مصنّع المعالج الرسومي |
| spec label | GPU | المعالج الرسومي |
| spec label | Video memory | ذاكرة الفيديو |
| spec label | Memory type | نوع الذاكرة |
| spec label | Memory bus | عرض ناقل الذاكرة |
| spec label | Board power | استهلاك الطاقة |
| spec label | Recommended PSU | مصدر الطاقة الموصى به |
| spec label | Card length | طول الكارت |
| spec label | Slot width | عدد الفتحات |
| spec label | Power connector | وصلة الطاقة |
| spec label | Interface | الواجهة |
| spec label | Chipset | الشيبسيت |
| spec label | Form factor | الحجم |
| spec label | Memory slots | عدد فتحات الذاكرة |
| spec label | Max memory | أقصى ذاكرة |
| spec label | M.2 slots | فتحات M.2 |
| spec label | SATA ports | منافذ SATA |
| spec label | Built-in Wi-Fi | واي فاي مدمج |
| spec label | Kit capacity | سعة الطقم |
| spec label | Modules in the kit | عدد الشرائح في الطقم |
| spec label | Speed | السرعة |
| spec label | CAS latency | زمن الاستجابة CL |
| spec label | Voltage | الجهد |
| spec label | Memory profiles | ملفات الذاكرة |
| spec label | RGB lighting | إضاءة RGB |
| spec label | Drive type | نوع القرص |
| spec label | Form factor | الشكل |
| spec label | Capacity | السعة |
| spec label | Sequential read | سرعة القراءة |
| spec label | Sequential write | سرعة الكتابة |
| spec label | PCIe generation | جيل PCIe |
| spec label | Endurance | العمر الافتراضي |
| spec label | Spindle speed | سرعة الدوران |
| spec label | Cache | الكاش |
| spec label | Wattage | القدرة |
| spec label | Efficiency | الكفاءة |
| spec label | Cabling | الكابلات |
| spec option | Non-modular | غير قابلة للفك |
| spec option | Semi-modular | نصف قابلة للفك |
| spec option | Fully modular | قابلة للفك بالكامل |
| spec label | Native 12V-2x6 (PCIe 5) cable | كابل 12V-2x6 أصلي |
| spec label | Type | النوع |
| spec option | Mid Tower | ميد تاور |
| spec option | Mini Tower | ميني تاور |
| spec option | Small form factor | حجم صغير |
| spec label | Motherboard support | اللوحات المدعومة |
| spec label | Max GPU length | أقصى طول للكارت |
| spec label | Max CPU cooler height | أقصى ارتفاع للمبرد |
| spec label | Power supply support | مصادر الطاقة المدعومة |
| spec label | Radiator sizes (mm) | مقاسات الراديتر (مم) |
| spec label | Cooler type | نوع المبرد |
| spec option | Air | هوائي |
| spec option | Liquid | مائي |
| spec label | Supported sockets | المقابس المدعومة |
| spec label | Height (air coolers) | الارتفاع (للهوائي) |
| spec label | Radiator size (liquid coolers) | مقاس الراديتر (للمائي) |
| spec label | Fans included | عدد المراوح |
| spec label | Manufacturer cooling rating | قدرة التبريد المعلنة |
| spec label | Fan size | مقاس المروحة |
| spec label | Max speed | أقصى سرعة |
| spec label | Connector | الوصلة |
| spec label | Fans in the pack | عدد المراوح بالعبوة |
| spec label | Processor | المعالج |
| spec label | Graphics | كارت الشاشة |
| spec label | Memory | الذاكرة |
| spec label | Storage | التخزين |
| spec label | Screen size | حجم الشاشة |
| spec label | Resolution | الدقة |
| spec label | Refresh rate | معدل التحديث |
| spec label | Panel | نوع الشاشة |
| spec label | Battery | البطارية |
| spec label | Panel | نوع اللوحة |
| spec label | Response time | زمن الاستجابة |
| spec label | Curved | منحنية |
| spec label | Adaptive sync | المزامنة التكيفية |
| spec label | USB-C input | مدخل USB-C |
| spec label | Layout | التخطيط |
| spec label | Switch type | نوع المفاتيح |
| spec label | Connectivity | الاتصال |
| spec label | Backlight | الإضاءة الخلفية |
| spec label | Max DPI | أقصى DPI |
| spec label | Buttons | عدد الأزرار |
| spec label | Sensor | الحساس |
| spec label | Driver size | حجم السماعة |
| spec label | Microphone | الميكروفون |
| spec label | Frame rate | معدل الإطارات |
| spec label | Autofocus | تركيز تلقائي |
| spec label | Built-in microphone | ميكروفون مدمج |
| spec label | Wi-Fi standard | معيار الواي فاي |
| spec label | Combined wireless speed | السرعة اللاسلكية المجمعة |
| spec label | Bands | النطاقات |
| spec label | LAN ports | منافذ LAN |
| spec label | Bluetooth | بلوتوث |
| spec label | Ports | عدد المنافذ |
| spec label | Port speed | سرعة المنفذ |
| spec label | Managed | قابل للإدارة |
| spec label | Connection | الاتصال |
| spec label | Pickup patterns | أنماط الالتقاط |
| spec label | Amount | الكمية |
| spec label | Electrically conductive | موصل للكهرباء |
| spec label | Surface | السطح |
| spec label | Best for | مناسب لـ |
| spec option | Gaming | الألعاب |
| spec option | Workstation | محطة عمل |
| spec option | Office and home | المكتب والمنزل |
| spec label | Target resolution | الدقة المستهدفة |

## Seed data: governorates and shipping zones (inserted from M6a)

| Where | English | Arabic (machine-written) |
| --- | --- | --- |
| governorate: cairo | Cairo | القاهرة |
| governorate: giza | Giza | الجيزة |
| governorate: alexandria | Alexandria | الإسكندرية |
| governorate: qalyubia | Qalyubia | القليوبية |
| governorate: port-said | Port Said | بورسعيد |
| governorate: suez | Suez | السويس |
| governorate: dakahlia | Dakahlia | الدقهلية |
| governorate: sharqia | Sharqia | الشرقية |
| governorate: gharbia | Gharbia | الغربية |
| governorate: monufia | Monufia | المنوفية |
| governorate: kafr-el-sheikh | Kafr El Sheikh | كفر الشيخ |
| governorate: beheira | Beheira | البحيرة |
| governorate: ismailia | Ismailia | الإسماعيلية |
| governorate: damietta | Damietta | دمياط |
| governorate: faiyum | Faiyum | الفيوم |
| governorate: beni-suef | Beni Suef | بني سويف |
| governorate: minya | Minya | المنيا |
| governorate: asyut | Asyut | أسيوط |
| governorate: sohag | Sohag | سوهاج |
| governorate: qena | Qena | قنا |
| governorate: luxor | Luxor | الأقصر |
| governorate: aswan | Aswan | أسوان |
| governorate: red-sea | Red Sea | البحر الأحمر |
| governorate: new-valley | New Valley | الوادي الجديد |
| governorate: matrouh | Matrouh | مطروح |
| governorate: north-sinai | North Sinai | شمال سيناء |
| governorate: south-sinai | South Sinai | جنوب سيناء |
| shipping zone: greater-cairo | Greater Cairo | القاهرة الكبرى |
| shipping zone: alexandria | Alexandria | الإسكندرية |
| shipping zone: delta | Nile Delta | الدلتا |
| shipping zone: canal | Suez Canal | القناة |
| shipping zone: upper-egypt | Upper Egypt | الصعيد |
| shipping zone: red-sea-sinai-frontier | Red Sea, Sinai and Frontier | البحر الأحمر وسيناء والمحافظات الحدودية |

## Seed catalog: bundles

| Where | English | Arabic (machine-written) |
| --- | --- | --- |
| bundle BND-BUDGET-1080P: title | Budget Gaming PC: Ryzen 5 5600 + RTX 4060 | تجميعة ألعاب اقتصادية: Ryzen 5 5600 مع RTX 4060 |
| bundle BND-BUDGET-1080P: short | Everything for a 1080p gaming PC on a sensible budget. | كل ما تحتاجه لجهاز ألعاب بدقة 1080p بميزانية معقولة. |
| bundle BND-BUDGET-1080P: description | A balanced AM4 build: a Ryzen 5 5600 (boxed cooler included), a B550 board, 16 GB of DDR4, an RTX 4060, a 1 TB NVMe drive and a 650 W power supply in a compact Micro-ATX case. Parts-in-box: components ship separately packed (no assembly). Each part keeps its own warranty. | تجميعة AM4 متوازنة: معالج Ryzen 5 5600 (المبرد داخل العلبة) ولوحة B550 وذاكرة DDR4 بسعة 16 جيجا وكارت RTX 4060 وقرص NVMe بسعة 1 تيرا ومصدر طاقة 650 واط في صندوق Micro-ATX صغير. القطع تُشحن منفصلة بدون تركيب، ولكل قطعة ضمانها الخاص. |
| bundle BND-MIDRANGE-1440P: title | Mid-Range Gaming PC: Ryzen 5 7600 + RTX 5060 Ti 16GB | تجميعة ألعاب متوسطة: Ryzen 5 7600 مع RTX 5060 Ti سعة 16 جيجا |
| bundle BND-MIDRANGE-1440P: short | A modern AM5 and DDR5 platform with 16 GB of video memory for 1440p. | منصة AM5 وDDR5 حديثة مع 16 جيجا ذاكرة فيديو للعب بدقة 1440p. |
| bundle BND-MIDRANGE-1440P: description | A current-generation build centred on a Ryzen 5 7600 and a 16 GB RTX 5060 Ti, with 32 GB of DDR5-6000, a fast 1 TB NVMe drive, an air cooler and a 750 W Gold power supply in an airflow case. Parts-in-box: components ship separately packed (no assembly). Each part keeps its own warranty. | تجميعة من الجيل الحالي تدور حول معالج Ryzen 5 7600 وكارت RTX 5060 Ti بسعة 16 جيجا مع ذاكرة DDR5-6000 بسعة 32 جيجا وقرص NVMe سريع بسعة 1 تيرا ومبرد هوائي ومصدر طاقة 750 واط Gold في صندوق جيد التهوية. القطع تُشحن منفصلة بدون تركيب، ولكل قطعة ضمانها الخاص. |
| bundle BND-PERFORMANCE-INTEL-1440P: title | Performance Gaming PC: Core i5-14400F + RX 9070 XT | تجميعة ألعاب عالية الأداء: Core i5-14400F مع RX 9070 XT |
| bundle BND-PERFORMANCE-INTEL-1440P: short | Intel and Radeon for high-refresh 1440p, on a DDR4 platform that keeps the price down. | إنتل مع رايدن للعب بمعدل تحديث عالٍ بدقة 1440p على منصة DDR4 تحافظ على السعر. |
| bundle BND-PERFORMANCE-INTEL-1440P: description | A Core i5-14400F (boxed cooler included) on a Micro-ATX B760 board with 32 GB of DDR4, paired with a 16 GB RX 9070 XT, a 1 TB NVMe drive and an 850 W Gold power supply in a roomy case. Parts-in-box: components ship separately packed (no assembly). Each part keeps its own warranty. | معالج Core i5-14400F (المبرد داخل العلبة) على لوحة B760 بحجم Micro-ATX مع ذاكرة DDR4 بسعة 32 جيجا، مع كارت RX 9070 XT بسعة 16 جيجا وقرص NVMe بسعة 1 تيرا ومصدر طاقة 850 واط Gold في صندوق واسع. القطع تُشحن منفصلة بدون تركيب، ولكل قطعة ضمانها الخاص. |
| bundle BND-HIGHEND-4K: title | High-End Gaming PC: Ryzen 7 7800X3D + RTX 5080 | تجميعة ألعاب فاخرة: Ryzen 7 7800X3D مع RTX 5080 |
| bundle BND-HIGHEND-4K: short | Top gaming CPU, a 16 GB RTX 5080 and a 360 mm liquid cooler for 4K. | أفضل معالج للألعاب مع كارت RTX 5080 بسعة 16 جيجا ومبرد مائي 360 مم للعب بدقة 4K. |
| bundle BND-HIGHEND-4K: description | A no-compromise gaming build: the Ryzen 7 7800X3D, an RTX 5080 Founders Edition, 32 GB of low-latency DDR5-6000, a 2 TB PCIe 4.0 drive, a 360 mm liquid cooler and a 1000 W Gold power supply. Parts-in-box: components ship separately packed (no assembly). Each part keeps its own warranty. | تجميعة ألعاب بلا تنازلات: معالج Ryzen 7 7800X3D وكارت RTX 5080 Founders Edition وذاكرة DDR5-6000 منخفضة زمن الاستجابة بسعة 32 جيجا وقرص PCIe 4.0 بسعة 2 تيرا ومبرد مائي 360 مم ومصدر طاقة 1000 واط Gold. القطع تُشحن منفصلة بدون تركيب، ولكل قطعة ضمانها الخاص. |
| bundle BND-WORKSTATION-CREATOR: title | Creator Workstation: Ryzen 9 9950X + 64GB + RTX 5070 | محطة عمل للمبدعين: Ryzen 9 9950X مع 64 جيجا وRTX 5070 |
| bundle BND-WORKSTATION-CREATOR: short | 16 cores, 64 GB of memory and two fast NVMe drives for rendering and editing. | 16 نواة وذاكرة 64 جيجا وقرصا NVMe سريعان للريندر والمونتاج. |
| bundle BND-WORKSTATION-CREATOR: description | Built for rendering, compiling and editing: a Ryzen 9 9950X with a dual-tower air cooler, 64 GB of DDR5, an RTX 5070, a 2 TB system drive plus a 1 TB scratch drive and an 850 W Gold power supply. Parts-in-box: components ship separately packed (no assembly). Each part keeps its own warranty. | مبنية للريندر والبرمجة والمونتاج: معالج Ryzen 9 9950X مع مبرد هوائي ببرجين وذاكرة DDR5 بسعة 64 جيجا وكارت RTX 5070 وقرص نظام بسعة 2 تيرا مع قرص عمل بسعة 1 تيرا ومصدر طاقة 850 واط Gold. القطع تُشحن منفصلة بدون تركيب، ولكل قطعة ضمانها الخاص. |
| bundle BND-OFFICE-HOME: title | Office & Home PC: Ryzen 5 7600 with Integrated Graphics | تجميعة مكتب ومنزل: Ryzen 5 7600 برسوميات مدمجة |
| bundle BND-OFFICE-HOME: short | A quiet, efficient PC for work, study and everyday use. No graphics card needed. | جهاز هادئ وموفر للطاقة للعمل والدراسة والاستخدام اليومي. لا يحتاج كارت شاشة. |
| bundle BND-OFFICE-HOME: description | A Ryzen 5 7600 with built-in graphics and its boxed cooler, 16 GB of DDR5, a 1 TB NVMe drive and a 550 W power supply in a compact Micro-ATX case. Parts-in-box: components ship separately packed (no assembly). Each part keeps its own warranty. | معالج Ryzen 5 7600 برسوميات مدمجة ومبرده داخل العلبة، مع ذاكرة DDR5 بسعة 16 جيجا وقرص NVMe بسعة 1 تيرا ومصدر طاقة 550 واط في صندوق Micro-ATX صغير. القطع تُشحن منفصلة بدون تركيب، ولكل قطعة ضمانها الخاص. |

## Seed catalog: products (titles and descriptions)

| Where | English | Arabic (machine-written) |
| --- | --- | --- |
| CPU-AMD-R5-5600: title | AMD Ryzen 5 5600 Processor | معالج AMD Ryzen 5 5600 |
| CPU-AMD-R5-5600: short | 6 cores and 12 threads on the AM4 socket: the value pick for a first gaming PC. | 6 أنوية و12 خيطاً بمقبس AM4: الاختيار الاقتصادي لأول جهاز ألعاب. |
| CPU-AMD-R5-7600: title | AMD Ryzen 5 7600 Processor | معالج AMD Ryzen 5 7600 |
| CPU-AMD-R5-7600: short | 6-core Zen 4 on AM5 with DDR5 support and basic integrated graphics. | معالج Zen 4 بـ 6 أنوية على AM5 مع دعم DDR5 ورسوميات مدمجة أساسية. |
| CPU-AMD-R7-7800X3D: title | AMD Ryzen 7 7800X3D Processor | معالج AMD Ryzen 7 7800X3D |
| CPU-AMD-R7-7800X3D: short | 8 cores with 96 MB of 3D V-Cache, a top choice for gaming. Cooler not included. | 8 أنوية مع ذاكرة 3D V-Cache بسعة 96 ميجابايت، من أفضل الخيارات للألعاب. بدون مبرد. |
| CPU-AMD-R7-7800X3D: description | The Ryzen 7 7800X3D stacks extra L3 cache on the die, which helps most in cache-hungry games. It runs on AM5 with DDR5 memory and ships without a cooler, so pair it with an air or liquid cooler. | يضيف معالج Ryzen 7 7800X3D ذاكرة مخبأة إضافية فوق الشريحة، وهو ما يفيد أكثر في الألعاب التي تعتمد على الكاش. يعمل على AM5 مع ذاكرة DDR5 ويأتي بدون مبرد، لذا يلزم مبرد هوائي أو مائي. |
| CPU-AMD-R7-9700X: title | AMD Ryzen 7 9700X Processor | معالج AMD Ryzen 7 9700X |
| CPU-AMD-R7-9700X: short | 8-core Zen 5 on AM5 with a 65 W TDP. Cooler not included. | معالج Zen 5 بـ 8 أنوية على AM5 بطاقة حرارية 65 واط. بدون مبرد. |
| CPU-AMD-R9-9950X: title | AMD Ryzen 9 9950X Processor | معالج AMD Ryzen 9 9950X |
| CPU-AMD-R9-9950X: short | 16 cores and 32 threads for rendering, compiling and heavy multitasking. Cooler not included. | 16 نواة و32 خيطاً للريندر والبرمجة والمهام الثقيلة. بدون مبرد. |
| CPU-INT-I5-12400F: title | Intel Core i5-12400F Processor | معالج Intel Core i5-12400F |
| CPU-INT-I5-12400F: short | 6 performance cores on LGA1700 with a boxed cooler. No integrated graphics. | 6 أنوية أداء على LGA1700 مع مبرد داخل العلبة. بدون رسوميات مدمجة. |
| CPU-INT-I5-14400F: title | Intel Core i5-14400F Processor | معالج Intel Core i5-14400F |
| CPU-INT-I5-14400F: short | 10 cores (6 performance + 4 efficiency) on LGA1700 with a boxed cooler. | 10 أنوية (6 أداء + 4 كفاءة) على LGA1700 مع مبرد داخل العلبة. |
| CPU-INT-I7-14700K: title | Intel Core i7-14700K Processor | معالج Intel Core i7-14700K |
| CPU-INT-I7-14700K: short | 20 cores (8 performance + 12 efficiency), unlocked for overclocking. Cooler not included. | 20 نواة (8 أداء + 12 كفاءة) مفتوح للأوفركلوك. بدون مبرد. |
| CPU-INT-I9-14900K: title | Intel Core i9-14900K Processor | معالج Intel Core i9-14900K |
| CPU-INT-I9-14900K: short | 24 cores (8 performance + 16 efficiency) with up to 6.0 GHz boost. Cooler not included. | 24 نواة (8 أداء + 16 كفاءة) بسرعة تصل إلى 6.0 جيجاهرتز. بدون مبرد. |
| GPU-ASUS-DUAL-RTX4060-O8G: title | ASUS Dual GeForce RTX 4060 OC Edition 8GB | كارت شاشة ASUS Dual GeForce RTX 4060 OC بسعة 8 جيجا |
| GPU-ASUS-DUAL-RTX4060-O8G: short | Efficient 1080p graphics card with DLSS 3 and an 8 GB buffer. | كارت شاشة اقتصادي في الطاقة للعب بدقة 1080p مع DLSS 3 وذاكرة 8 جيجا. |
| GPU-MSI-RTX5060-VENTUS2X-8G: title | MSI GeForce RTX 5060 Ventus 2X OC 8GB | كارت شاشة MSI GeForce RTX 5060 Ventus 2X OC بسعة 8 جيجا |
| GPU-MSI-RTX5060-VENTUS2X-8G: short | Current-generation 1080p card with GDDR7 memory and DLSS 4. | كارت من الجيل الحالي للعب بدقة 1080p بذاكرة GDDR7 ودعم DLSS 4. |
| GPU-GIGABYTE-RTX5060TI-WF-16G: title | Gigabyte GeForce RTX 5060 Ti WINDFORCE OC 16GB | كارت شاشة Gigabyte GeForce RTX 5060 Ti WINDFORCE OC بسعة 16 جيجا |
| GPU-GIGABYTE-RTX5060TI-WF-16G: short | 16 GB of GDDR7 for 1440p gaming and newer texture-heavy games. | ذاكرة GDDR7 بسعة 16 جيجا للعب بدقة 1440p والألعاب الحديثة كثيفة الخامات. |
| GPU-GIGABYTE-RTX5060TI-WF-16G: description | A 16 GB RTX 5060 Ti gives 1440p players headroom that 8 GB cards lack in modern titles. Power draw is moderate, so a quality 650 W unit is plenty. | يمنح كارت RTX 5060 Ti بسعة 16 جيجا مساحة إضافية للاعبي 1440p لا تتوفر في الكروت ذات 8 جيجا في الألعاب الحديثة. استهلاكه للطاقة متوسط، ويكفيه مصدر طاقة جيد بقدرة 650 واط. |
| GPU-ASUS-PRIME-RTX5070-O12G: title | ASUS Prime GeForce RTX 5070 OC Edition 12GB | كارت شاشة ASUS Prime GeForce RTX 5070 OC بسعة 12 جيجا |
| GPU-ASUS-PRIME-RTX5070-O12G: short | 12 GB GDDR7 card aimed at smooth 1440p gaming and light creator work. | كارت بذاكرة GDDR7 بسعة 12 جيجا للعب سلس بدقة 1440p وأعمال الإبداع الخفيفة. |
| GPU-MSI-RTX5070TI-GAMINGTRIO-16G: title | MSI GeForce RTX 5070 Ti 16G Gaming Trio OC | كارت شاشة MSI GeForce RTX 5070 Ti 16G Gaming Trio OC |
| GPU-MSI-RTX5070TI-GAMINGTRIO-16G: short | High-refresh 1440p and entry 4K with 16 GB of GDDR7 and a triple-fan cooler. | أداء عالٍ بدقة 1440p ودقة 4K للمبتدئين مع 16 جيجا GDDR7 ومبرد بثلاث مراوح. |
| GPU-NVIDIA-RTX5080-FE: title | NVIDIA GeForce RTX 5080 Founders Edition 16GB | كارت شاشة NVIDIA GeForce RTX 5080 Founders Edition بسعة 16 جيجا |
| GPU-NVIDIA-RTX5080-FE: short | NVIDIA's own dual-slot RTX 5080 with 16 GB of GDDR7 for 4K gaming. | كارت RTX 5080 من إنتاج NVIDIA بفتحتين وذاكرة GDDR7 بسعة 16 جيجا للعب بدقة 4K. |
| GPU-NVIDIA-RTX5080-FE: description | The Founders Edition keeps the RTX 5080 to two slots and about 30 cm of length, which fits cases that struggle with large partner cards. It needs a 12V-2x6 power cable and a quality 850 W (or larger) power supply. | تحافظ نسخة Founders Edition على كارت RTX 5080 بفتحتين وطول نحو 30 سم، فيناسب الصناديق التي يصعب عليها استيعاب كروت الشركاء الكبيرة. يحتاج كابل طاقة 12V-2x6 ومصدر طاقة جيداً بقدرة 850 واط أو أكثر. |
| GPU-GIGABYTE-RX7600-GAMING-OC-8G: title | Gigabyte Radeon RX 7600 Gaming OC 8GB | كارت شاشة Gigabyte Radeon RX 7600 Gaming OC بسعة 8 جيجا |
| GPU-GIGABYTE-RX7600-GAMING-OC-8G: short | Entry 1080p card from AMD with FreeSync support and an 8 GB buffer. | كارت اقتصادي من AMD للعب بدقة 1080p مع دعم FreeSync وذاكرة 8 جيجا. |
| GPU-GIGABYTE-RX9070XT-GAMING-OC-16G: title | Gigabyte Radeon RX 9070 XT Gaming OC 16GB | كارت شاشة Gigabyte Radeon RX 9070 XT Gaming OC بسعة 16 جيجا |
| GPU-GIGABYTE-RX9070XT-GAMING-OC-16G: short | 16 GB RDNA 4 card built for high-refresh 1440p and capable 4K gaming. | كارت RDNA 4 بسعة 16 جيجا للعب بمعدل تحديث عالٍ بدقة 1440p ودقة 4K. |
| GPU-INTEL-ARC-B580-LE-12G: title | Intel Arc B580 Limited Edition 12GB | كارت شاشة Intel Arc B580 Limited Edition بسعة 12 جيجا |
| GPU-INTEL-ARC-B580-LE-12G: short | 12 GB of memory at an entry price, a strong option for 1080p and light 1440p. | ذاكرة 12 جيجا بسعر اقتصادي، خيار قوي للعب بدقة 1080p و1440p الخفيف. |
| MB-GIGABYTE-B550M-DS3H: title | Gigabyte B550M DS3H Motherboard (AM4) | لوحة أم Gigabyte B550M DS3H (AM4) |
| MB-GIGABYTE-B550M-DS3H: short | Compact AM4 board with DDR4 and PCIe 4.0: the budget base for Ryzen 5000. | لوحة صغيرة بمقبس AM4 وذاكرة DDR4 وPCIe 4.0: أساس اقتصادي لمعالجات Ryzen 5000. |
| MB-MSI-PRO-B650M-A-WIFI: title | MSI PRO B650M-A WIFI Motherboard (AM5) | لوحة أم MSI PRO B650M-A WIFI (AM5) |
| MB-MSI-PRO-B650M-A-WIFI: short | Micro-ATX AM5 board with DDR5 and built-in Wi-Fi for compact builds. | لوحة Micro-ATX بمقبس AM5 وذاكرة DDR5 وواي فاي مدمج للتجميعات الصغيرة. |
| MB-MSI-MAG-B650-TOMAHAWK-WIFI: title | MSI MAG B650 TOMAHAWK WIFI Motherboard (AM5) | لوحة أم MSI MAG B650 TOMAHAWK WIFI (AM5) |
| MB-MSI-MAG-B650-TOMAHAWK-WIFI: short | Full-size AM5 board with strong power delivery, Wi-Fi 6E and DDR5. | لوحة كاملة الحجم بمقبس AM5 وتغذية طاقة قوية وواي فاي 6E وذاكرة DDR5. |
| MB-ASUS-TUF-B650-PLUS-WIFI: title | ASUS TUF Gaming B650-PLUS WiFi Motherboard (AM5) | لوحة أم ASUS TUF Gaming B650-PLUS WiFi (AM5) |
| MB-ASUS-TUF-B650-PLUS-WIFI: short | Durable ATX AM5 board with DDR5, PCIe 5.0 and Wi-Fi 6. | لوحة ATX متينة بمقبس AM5 وذاكرة DDR5 وPCIe 5.0 وواي فاي 6. |
| MB-MSI-PRO-B760M-A-WIFI-DDR4: title | MSI PRO B760M-A WIFI DDR4 Motherboard (LGA1700) | لوحة أم MSI PRO B760M-A WIFI DDR4 (LGA1700) |
| MB-MSI-PRO-B760M-A-WIFI-DDR4: short | Micro-ATX LGA1700 board using DDR4, a cost-saving base for 12th to 14th gen Intel. | لوحة Micro-ATX بمقبس LGA1700 وذاكرة DDR4، أساس موفّر لمعالجات إنتل من الجيل 12 إلى 14. |
| MB-ASUS-TUF-B760-PLUS-WIFI-D4: title | ASUS TUF Gaming B760-PLUS WiFi D4 Motherboard (LGA1700) | لوحة أم ASUS TUF Gaming B760-PLUS WiFi D4 (LGA1700) |
| MB-ASUS-TUF-B760-PLUS-WIFI-D4: short | ATX LGA1700 board with DDR4, Wi-Fi 6 and a sturdy power design. | لوحة ATX بمقبس LGA1700 وذاكرة DDR4 وواي فاي 6 وتصميم طاقة متين. |
| MB-GIGABYTE-Z790-AORUS-ELITE-AX: title | Gigabyte Z790 AORUS ELITE AX Motherboard (LGA1700) | لوحة أم Gigabyte Z790 AORUS ELITE AX (LGA1700) |
| MB-GIGABYTE-Z790-AORUS-ELITE-AX: short | Overclocking-ready Z790 board with DDR5, three M.2 slots and Wi-Fi 6E. | لوحة Z790 جاهزة للأوفركلوك مع DDR5 وثلاث فتحات M.2 وواي فاي 6E. |
| RAM-KINGSTON-FURY-D5-32G-6000: title | Kingston FURY Beast DDR5 32GB (2x16GB) 6000MT/s CL40 | ذاكرة Kingston FURY Beast DDR5 سعة 32 جيجا (2x16) بسرعة 6000 |
| RAM-KINGSTON-FURY-D5-32G-6000: short | A 32 GB DDR5-6000 kit, the sweet spot for current AM5 and Intel platforms. | طقم DDR5-6000 بسعة 32 جيجا، الخيار المتوازن للمنصات الحديثة من AMD وإنتل. |
| RAM-KINGSTON-FURY-D5-16G-5600: title | Kingston FURY Beast DDR5 16GB (2x8GB) 5600MT/s CL40 | ذاكرة Kingston FURY Beast DDR5 سعة 16 جيجا (2x8) بسرعة 5600 |
| RAM-KINGSTON-FURY-D5-16G-5600: short | A 16 GB DDR5-5600 kit for everyday and office PCs on a DDR5 platform. | طقم DDR5-5600 بسعة 16 جيجا لأجهزة الاستخدام اليومي والمكتب على منصة DDR5. |
| RAM-KINGSTON-RENEGADE-D5-32G-6400: title | Kingston FURY Renegade DDR5 32GB (2x16GB) 6400MT/s CL32 | ذاكرة Kingston FURY Renegade DDR5 سعة 32 جيجا (2x16) بسرعة 6400 |
| RAM-KINGSTON-RENEGADE-D5-32G-6400: short | Fast, low-latency DDR5 for enthusiasts who tune their memory. | ذاكرة DDR5 سريعة منخفضة زمن الاستجابة لمحبي ضبط الذاكرة. |
| RAM-CORSAIR-VENGEANCE-D5-32G-6000: title | Corsair VENGEANCE DDR5 32GB (2x16GB) 6000MT/s CL30 | ذاكرة Corsair VENGEANCE DDR5 سعة 32 جيجا (2x16) بسرعة 6000 |
| RAM-CORSAIR-VENGEANCE-D5-32G-6000: short | Low-latency DDR5-6000 that suits gaming PCs on AM5 and Intel boards. | ذاكرة DDR5-6000 بزمن استجابة منخفض تناسب أجهزة الألعاب على لوحات AM5 وإنتل. |
| RAM-CORSAIR-VENGEANCE-D5-64G-5600: title | Corsair VENGEANCE DDR5 64GB (2x32GB) 5600MT/s CL40 | ذاكرة Corsair VENGEANCE DDR5 سعة 64 جيجا (2x32) بسرعة 5600 |
| RAM-CORSAIR-VENGEANCE-D5-64G-5600: short | 64 GB in two modules for video editing, virtual machines and large projects. | 64 جيجا في شريحتين لمونتاج الفيديو والأجهزة الافتراضية والمشاريع الكبيرة. |
| RAM-KINGSTON-FURY-D4-16G-3200: title | Kingston FURY Beast DDR4 16GB (2x8GB) 3200MT/s CL16 | ذاكرة Kingston FURY Beast DDR4 سعة 16 جيجا (2x8) بسرعة 3200 |
| RAM-KINGSTON-FURY-D4-16G-3200: short | A dependable 16 GB DDR4-3200 kit for AM4 and DDR4 Intel builds. | طقم DDR4-3200 بسعة 16 جيجا موثوق لتجميعات AM4 وإنتل بذاكرة DDR4. |
| RAM-CORSAIR-LPX-D4-32G-3200: title | Corsair VENGEANCE LPX DDR4 32GB (2x16GB) 3200MT/s CL16 | ذاكرة Corsair VENGEANCE LPX DDR4 سعة 32 جيجا (2x16) بسرعة 3200 |
| RAM-CORSAIR-LPX-D4-32G-3200: short | Low-profile 32 GB DDR4 that fits under large air coolers. | ذاكرة DDR4 بسعة 32 جيجا منخفضة الارتفاع تناسب تحت المبردات الهوائية الكبيرة. |
| SSD-SAMSUNG-990EVO-1TB: title | Samsung 990 EVO 1TB NVMe M.2 SSD | هارد SSD سامسونج 990 EVO سعة 1 تيرا NVMe M.2 |
| SSD-SAMSUNG-990EVO-1TB: short | Fast and efficient 1 TB NVMe drive for gaming PCs and laptops. | قرص NVMe سريع وموفر للطاقة بسعة 1 تيرا لأجهزة الألعاب واللابتوب. |
| SSD-SAMSUNG-990PRO-2TB: title | Samsung 990 PRO 2TB NVMe M.2 SSD | هارد SSD سامسونج 990 PRO سعة 2 تيرا NVMe M.2 |
| SSD-SAMSUNG-990PRO-2TB: short | PCIe 4.0 flagship with 2 TB of capacity for editing and large game libraries. | قرص PCIe 4.0 رائد بسعة 2 تيرا للمونتاج ومكتبات الألعاب الكبيرة. |
| SSD-WD-BLUE-SN580-1TB: title | WD Blue SN580 1TB NVMe M.2 SSD | هارد SSD WD Blue SN580 سعة 1 تيرا NVMe M.2 |
| SSD-WD-BLUE-SN580-1TB: short | Everyday PCIe 4.0 SSD with solid speed at a friendly price. | قرص PCIe 4.0 للاستخدام اليومي بسرعة جيدة وسعر مناسب. |
| SSD-WD-BLACK-SN850X-1TB: title | WD_BLACK SN850X 1TB NVMe M.2 SSD | هارد SSD WD_BLACK SN850X سعة 1 تيرا NVMe M.2 |
| SSD-WD-BLACK-SN850X-1TB: short | High-speed PCIe 4.0 drive built for gaming load times. | قرص PCIe 4.0 عالي السرعة مصمم لتقليل أوقات تحميل الألعاب. |
| SSD-KINGSTON-NV3-1TB: title | Kingston NV3 1TB NVMe M.2 SSD | هارد SSD كينجستون NV3 سعة 1 تيرا NVMe M.2 |
| SSD-KINGSTON-NV3-1TB: short | Budget PCIe 4.0 NVMe drive for upgrading from SATA or a hard drive. | قرص PCIe 4.0 NVMe اقتصادي للترقية من SATA أو القرص الصلب. |
| SSD-SAMSUNG-870EVO-1TB: title | Samsung 870 EVO 1TB 2.5-inch SATA SSD | هارد SSD سامسونج 870 EVO سعة 1 تيرا SATA مقاس 2.5 |
| SSD-SAMSUNG-870EVO-1TB: short | The classic reliable SATA SSD for upgrading older PCs and laptops. | قرص SATA موثوق لترقية الأجهزة واللابتوبات القديمة. |
| HDD-WD-BLUE-2TB-7200: title | WD Blue 2TB 3.5-inch Hard Drive (7200 RPM) | هارد WD Blue سعة 2 تيرا مقاس 3.5 (7200 لفة) |
| HDD-WD-BLUE-2TB-7200: short | Spacious desktop hard drive for backups and media libraries. | قرص صلب واسع للكمبيوتر المكتبي للنسخ الاحتياطي ومكتبات الوسائط. |
| PSU-CM-MWE-BRONZE-550-V2: title | Cooler Master MWE Bronze 550 V2 Power Supply | مصدر طاقة Cooler Master MWE Bronze 550 V2 |
| PSU-CM-MWE-BRONZE-550-V2: short | 550 W 80+ Bronze unit for office and entry-level builds. | مصدر طاقة 550 واط بشهادة 80+ Bronze لأجهزة المكتب والتجميعات الاقتصادية. |
| PSU-CORSAIR-CX650: title | Corsair CX650 650W 80+ Bronze Power Supply | مصدر طاقة Corsair CX650 بقدرة 650 واط 80+ Bronze |
| PSU-CORSAIR-CX650: short | Dependable 650 W supply for mainstream gaming PCs. | مصدر طاقة موثوق بقدرة 650 واط لأجهزة الألعاب المتوسطة. |
| PSU-CM-MWE-GOLD-750-V2: title | Cooler Master MWE Gold 750 V2 Fully Modular Power Supply | مصدر طاقة Cooler Master MWE Gold 750 V2 قابل للفك بالكامل |
| PSU-CM-MWE-GOLD-750-V2: short | 750 W 80+ Gold with fully modular cables for tidy builds. | مصدر طاقة 750 واط بشهادة 80+ Gold وكابلات قابلة للفك لتجميع منظم. |
| PSU-CORSAIR-RM750E: title | Corsair RM750e 750W 80+ Gold Fully Modular Power Supply | مصدر طاقة Corsair RM750e بقدرة 750 واط 80+ Gold |
| PSU-CORSAIR-RM750E: short | Quiet fully modular 750 W Gold supply with a 12V-2x6 cable for modern graphics cards. | مصدر طاقة هادئ 750 واط Gold قابل للفك بالكامل مع كابل 12V-2x6 لكروت الشاشة الحديثة. |
| PSU-MSI-MAG-A850GL-PCIE5: title | MSI MAG A850GL PCIE5 850W 80+ Gold Power Supply | مصدر طاقة MSI MAG A850GL PCIE5 بقدرة 850 واط 80+ Gold |
| PSU-MSI-MAG-A850GL-PCIE5: short | 850 W Gold with a native PCIe 5 cable for power-hungry graphics cards. | مصدر طاقة 850 واط Gold مع كابل PCIe 5 أصلي لكروت الشاشة عالية الاستهلاك. |
| PSU-MSI-MPG-A1000G-PCIE5: title | MSI MPG A1000G PCIE5 1000W 80+ Gold Power Supply | مصدر طاقة MSI MPG A1000G PCIE5 بقدرة 1000 واط 80+ Gold |
| PSU-MSI-MPG-A1000G-PCIE5: short | 1000 W of headroom for flagship graphics cards and overclocked CPUs. | قدرة 1000 واط مريحة لكروت الشاشة الرائدة والمعالجات المرفوعة السرعة. |
| CASE-NZXT-H5-FLOW: title | NZXT H5 Flow ATX Mid-Tower Case | صندوق كمبيوتر NZXT H5 Flow ATX ميد تاور |
| CASE-NZXT-H5-FLOW: short | Airflow-focused mid tower with a perforated front panel and simple cable management. | صندوق ميد تاور يركز على تدفق الهواء بواجهة مثقبة وتنظيم كابلات سهل. |
| CASE-CORSAIR-4000D-AIRFLOW: title | Corsair 4000D Airflow Mid-Tower Case | صندوق كمبيوتر Corsair 4000D Airflow ميد تاور |
| CASE-CORSAIR-4000D-AIRFLOW: short | A proven mid tower with room for a 360 mm radiator and long graphics cards. | ميد تاور مجرّب بمساحة لراديتر 360 مم وكروت شاشة طويلة. |
| CASE-LIANLI-LANCOOL-216: title | Lian Li LANCOOL 216 Mid-Tower Case | صندوق كمبيوتر Lian Li LANCOOL 216 ميد تاور |
| CASE-LIANLI-LANCOOL-216: short | Spacious high-airflow case that fits very long graphics cards and tall coolers. | صندوق واسع بتدفق هواء عالٍ يتسع لأطول كروت الشاشة والمبردات المرتفعة. |
| CASE-CM-MASTERBOX-Q300L: title | Cooler Master MasterBox Q300L Micro-ATX Case | صندوق كمبيوتر Cooler Master MasterBox Q300L Micro-ATX |
| CASE-CM-MASTERBOX-Q300L: short | Small, affordable Micro-ATX tower for budget and office builds. | صندوق Micro-ATX صغير واقتصادي لتجميعات الميزانية والمكتب. |
| CASE-CM-NR200P: title | Cooler Master NR200P Mini-ITX Case | صندوق كمبيوتر Cooler Master NR200P Mini-ITX |
| CASE-CM-NR200P: short | Compact Mini-ITX case that takes SFX power supplies and a full-size graphics card. | صندوق Mini-ITX صغير يستوعب مصادر طاقة SFX وكارت شاشة كامل الحجم. |
| COOL-DEEPCOOL-AK400: title | DeepCool AK400 CPU Air Cooler | مبرد معالج هوائي DeepCool AK400 |
| COOL-DEEPCOOL-AK400: short | Single-tower air cooler that handles mainstream CPUs quietly at a low price. | مبرد هوائي ببرج واحد يبرد المعالجات المتوسطة بهدوء وبسعر منخفض. |
| COOL-CM-HYPER-212-BLACK: title | Cooler Master Hyper 212 Black Edition Air Cooler | مبرد معالج هوائي Cooler Master Hyper 212 Black Edition |
| COOL-CM-HYPER-212-BLACK: short | The long-running budget favourite with a direct-contact heat pipe design. | المبرد الاقتصادي المفضل منذ سنوات بتصميم أنابيب حرارية بتلامس مباشر. |
| COOL-NOCTUA-NH-D15: title | Noctua NH-D15 Dual-Tower CPU Cooler | مبرد معالج Noctua NH-D15 ببرجين |
| COOL-NOCTUA-NH-D15: short | Dual-tower air cooler with two fans, known for near-liquid performance and low noise. | مبرد هوائي ببرجين ومروحتين، معروف بأداء قريب من المائي وضوضاء منخفضة. |
| COOL-CM-MASTERLIQUID-ML240L-V2: title | Cooler Master MasterLiquid ML240L V2 RGB 240mm AIO | مبرد مائي Cooler Master MasterLiquid ML240L V2 RGB مقاس 240 مم |
| COOL-CM-MASTERLIQUID-ML240L-V2: short | 240 mm all-in-one liquid cooler with RGB lighting. | مبرد مائي متكامل بمقاس 240 مم مع إضاءة RGB. |
| COOL-CM-MASTERLIQUID-ML360L-V2: title | Cooler Master MasterLiquid ML360L ARGB V2 360mm AIO | مبرد مائي Cooler Master MasterLiquid ML360L ARGB V2 مقاس 360 مم |
| COOL-CM-MASTERLIQUID-ML360L-V2: short | 360 mm all-in-one liquid cooler for high-power CPUs, with addressable RGB fans. | مبرد مائي متكامل بمقاس 360 مم للمعالجات عالية الاستهلاك مع مراوح RGB قابلة للتحكم. |
| FAN-NOCTUA-NF-A12X25-PWM: title | Noctua NF-A12x25 PWM 120mm Fan | مروحة Noctua NF-A12x25 PWM مقاس 120 مم |
| FAN-NOCTUA-NF-A12X25-PWM: short | Premium quiet 120 mm fan with strong airflow and static pressure. | مروحة 120 مم هادئة ممتازة بتدفق هواء وضغط ساكن قويين. |
| FAN-NOCTUA-NF-P12-REDUX-1700: title | Noctua NF-P12 redux-1700 PWM 120mm Fan | مروحة Noctua NF-P12 redux-1700 PWM مقاس 120 مم |
| FAN-NOCTUA-NF-P12-REDUX-1700: short | Affordable, quiet 120 mm PWM fan for cases and radiators. | مروحة 120 مم PWM هادئة واقتصادية للصناديق والراديتر. |
| LAP-LENOVO-LOQ-15IRX9: title | Lenovo LOQ 15IRX9 Gaming Laptop (Core i5, RTX 4050) | لابتوب ألعاب Lenovo LOQ 15IRX9 (Core i5 وRTX 4050) |
| LAP-LENOVO-LOQ-15IRX9: short | Entry gaming laptop with a 144 Hz screen and an RTX 4050 for 1080p play. | لابتوب ألعاب اقتصادي بشاشة 144 هرتز وكارت RTX 4050 للعب بدقة 1080p. |
| LAP-ASUS-TUF-A15-FA507NV: title | ASUS TUF Gaming A15 FA507NV (Ryzen 7, RTX 4060) | لابتوب ASUS TUF Gaming A15 FA507NV (Ryzen 7 وRTX 4060) |
| LAP-ASUS-TUF-A15-FA507NV: short | Durable 15.6-inch gaming laptop with a Ryzen 7 and an RTX 4060. | لابتوب ألعاب متين بشاشة 15.6 بوصة ومعالج Ryzen 7 وكارت RTX 4060. |
| LAP-ASUS-ZENBOOK-14-OLED-UX3405MA: title | ASUS Zenbook 14 OLED UX3405MA (Core Ultra 7) | لابتوب ASUS Zenbook 14 OLED UX3405MA (Core Ultra 7) |
| LAP-ASUS-ZENBOOK-14-OLED-UX3405MA: short | Light 14-inch ultrabook with a sharp 120 Hz OLED screen. | ألترابوك خفيف بشاشة 14 بوصة OLED حادة بمعدل 120 هرتز. |
| LAP-LENOVO-THINKPAD-E14-G5: title | Lenovo ThinkPad E14 Gen 5 (Core i5, 16GB) | لابتوب Lenovo ThinkPad E14 Gen 5 (Core i5 وذاكرة 16 جيجا) |
| LAP-LENOVO-THINKPAD-E14-G5: short | Business laptop with a 14-inch Full HD display and a reliable keyboard. | لابتوب أعمال بشاشة 14 بوصة Full HD ولوحة مفاتيح مريحة وموثوقة. |
| MON-LG-27GP850-B: title | LG UltraGear 27GP850-B 27" QHD 165Hz Nano IPS Gaming Monitor | شاشة ألعاب LG UltraGear 27GP850-B مقاس 27 بوصة QHD بتردد 165 هرتز |
| MON-LG-27GP850-B: short | 27-inch QHD Nano IPS with a fast 165 Hz refresh for competitive gaming. | شاشة Nano IPS مقاس 27 بوصة بدقة QHD وتردد سريع 165 هرتز للألعاب التنافسية. |
| MON-GIGABYTE-M27Q: title | Gigabyte M27Q 27" QHD 170Hz IPS Gaming Monitor | شاشة ألعاب Gigabyte M27Q مقاس 27 بوصة QHD بتردد 170 هرتز |
| MON-GIGABYTE-M27Q: short | 27-inch QHD IPS with a built-in KVM switch and a high refresh rate. | شاشة IPS مقاس 27 بوصة QHD مع مفتاح KVM مدمج وتردد تحديث عالٍ. |
| MON-SAMSUNG-ODYSSEY-G5-34: title | Samsung Odyssey G5 34" Ultrawide 165Hz Curved Gaming Monitor | شاشة سامسونج Odyssey G5 مقاس 34 بوصة عريضة منحنية بتردد 165 هرتز |
| MON-SAMSUNG-ODYSSEY-G5-34: short | 34-inch 1000R curved ultrawide for immersive gaming and multitasking. | شاشة عريضة منحنية 1000R مقاس 34 بوصة للألعاب الغامرة وتعدد المهام. |
| MON-LG-24MR400-B: title | LG 24MR400-B 24" Full HD 100Hz IPS Monitor | شاشة LG 24MR400-B مقاس 24 بوصة Full HD بتردد 100 هرتز |
| MON-LG-24MR400-B: short | Affordable 24-inch IPS monitor for home and office, with a smooth 100 Hz refresh. | شاشة IPS اقتصادية مقاس 24 بوصة للمنزل والمكتب بتردد سلس 100 هرتز. |
| MON-LG-27UP850N-W: title | LG 27UP850N-W 27" 4K UHD IPS Monitor with USB-C | شاشة LG 27UP850N-W مقاس 27 بوصة 4K UHD IPS مع USB-C |
| MON-LG-27UP850N-W: short | Sharp 4K IPS display with USB-C charging, a good fit for creators and laptop users. | شاشة 4K IPS حادة مع شحن USB-C، مناسبة للمبدعين ومستخدمي اللابتوب. |
| KB-REDRAGON-K552-KUMARA: title | Redragon K552 Kumara Mechanical Gaming Keyboard (TKL) | كيبورد ميكانيكال Redragon K552 Kumara للألعاب (TKL) |
| KB-REDRAGON-K552-KUMARA: short | Compact tenkeyless mechanical keyboard that has become a budget classic. | كيبورد ميكانيكال مدمج بدون لوحة أرقام، أصبح اختياراً اقتصادياً كلاسيكياً. |
| KB-LOGITECH-MX-KEYS-S: title | Logitech MX Keys S Wireless Keyboard | كيبورد لاسلكي Logitech MX Keys S |
| KB-LOGITECH-MX-KEYS-S: short | Low-profile wireless keyboard for productivity, with smart backlighting. | كيبورد لاسلكي منخفض الارتفاع للإنتاجية مع إضاءة خلفية ذكية. |
| MOUSE-LOGITECH-G502-HERO: title | Logitech G502 HERO Gaming Mouse | ماوس ألعاب Logitech G502 HERO |
| MOUSE-LOGITECH-G502-HERO: short | Popular wired gaming mouse with a 25,600 DPI sensor and tunable weights. | ماوس ألعاب سلكي شهير بحساس 25600 DPI وأوزان قابلة للتعديل. |
| MOUSE-LOGITECH-G305-LIGHTSPEED: title | Logitech G305 LIGHTSPEED Wireless Gaming Mouse | ماوس ألعاب لاسلكي Logitech G305 LIGHTSPEED |
| MOUSE-LOGITECH-G305-LIGHTSPEED: short | Light wireless gaming mouse with a fast 2.4 GHz connection and long battery life. | ماوس ألعاب لاسلكي خفيف باتصال 2.4 جيجاهرتز سريع وعمر بطارية طويل. |
| HS-HYPERX-CLOUD-II: title | HyperX Cloud II Gaming Headset | سماعة ألعاب HyperX Cloud II |
| HS-HYPERX-CLOUD-II: short | Comfortable wired gaming headset with 53 mm drivers and a detachable microphone. | سماعة ألعاب سلكية مريحة بسماعات 53 مم وميكروفون قابل للفصل. |
| CAM-LOGITECH-C920-HD-PRO: title | Logitech C920 HD Pro Webcam | كاميرا ويب Logitech C920 HD Pro |
| CAM-LOGITECH-C920-HD-PRO: short | Full HD 1080p webcam with autofocus and stereo microphones for calls and streaming. | كاميرا ويب Full HD بدقة 1080p مع تركيز تلقائي وميكروفونات ستيريو للمكالمات والبث. |
| NET-TPLINK-ARCHER-AX55: title | TP-Link Archer AX55 AX3000 Wi-Fi 6 Router | راوتر TP-Link Archer AX55 AX3000 واي فاي 6 |
| NET-TPLINK-ARCHER-AX55: short | Dual-band Wi-Fi 6 router with Gigabit ports for fast home networks. | راوتر واي فاي 6 ثنائي النطاق بمنافذ جيجابت لشبكات منزلية سريعة. |
| NET-TPLINK-ARCHER-TX20E: title | TP-Link Archer TX20E AX1800 Wi-Fi 6 PCIe Adapter | كارت واي فاي TP-Link Archer TX20E AX1800 واي فاي 6 PCIe |
| NET-TPLINK-ARCHER-TX20E: short | PCIe Wi-Fi 6 card with Bluetooth to add wireless to a desktop PC. | كارت واي فاي 6 بواجهة PCIe مع بلوتوث لإضافة الاتصال اللاسلكي لجهاز مكتبي. |
| NET-TPLINK-TL-SG108: title | TP-Link TL-SG108 8-Port Gigabit Desktop Switch | سويتش TP-Link TL-SG108 بـ 8 منافذ جيجابت |
| NET-TPLINK-TL-SG108: short | Plug-and-play 8-port Gigabit switch for home offices and small setups. | سويتش جيجابت بـ 8 منافذ جاهز للاستخدام فوراً للمكاتب المنزلية والتجهيزات الصغيرة. |
| MIC-HYPERX-QUADCAST-S: title | HyperX QuadCast S USB Condenser Microphone | ميكروفون HyperX QuadCast S USB كوندنسر |
| MIC-HYPERX-QUADCAST-S: short | USB condenser microphone with four pickup patterns and RGB lighting for streaming. | ميكروفون كوندنسر USB بأربعة أنماط التقاط وإضاءة RGB للبث. |
| MIC-LOGITECH-BLUE-YETI: title | Logitech Blue Yeti USB Microphone | ميكروفون Logitech Blue Yeti USB |
| MIC-LOGITECH-BLUE-YETI: short | Well-known USB microphone with multiple pickup patterns for podcasts and calls. | ميكروفون USB معروف بأنماط التقاط متعددة للبودكاست والمكالمات. |
| ACC-NOCTUA-NT-H1-3G5: title | Noctua NT-H1 Thermal Compound (3.5g) | معجون حراري Noctua NT-H1 (3.5 جم) |
| ACC-NOCTUA-NT-H1-3G5: short | High-quality, non-conductive thermal paste enough for several CPU installs. | معجون حراري عالي الجودة غير موصل للكهرباء يكفي لعدة تركيبات للمعالج. |
| ACC-LOGITECH-G640: title | Logitech G640 Large Cloth Gaming Mouse Pad | ماوس باد Logitech G640 كبير قماشي للألعاب |
| ACC-LOGITECH-G640: short | Large cloth mouse pad with a consistent surface for precise tracking. | ماوس باد قماشي كبير بسطح ثابت لتتبع دقيق. |

<!-- prettier-ignore-end -->
