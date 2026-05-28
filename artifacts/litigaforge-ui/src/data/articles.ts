export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export interface ArticleSection {
  heading?: string;
  blocks: ContentBlock[];
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  category: string;
  readTime: number;
  publishedDate: string;
  sections: ArticleSection[];
}

const p = (text: string): ContentBlock => ({ type: "paragraph", text });
const ul = (...items: string[]): ContentBlock => ({ type: "list", items });

export const articles: Article[] = [
  {
    slug: "how-to-find-good-lawyer-hyderabad",
    title: "How to Find a Good Lawyer in Hyderabad (2026 Guide)",
    description:
      "A complete guide to finding a qualified, verified advocate in Hyderabad — covering Bar Council registration, specialisation, fee structures, and red flags to avoid.",
    keywords: [
      "find lawyer Hyderabad",
      "good advocate Hyderabad",
      "how to hire lawyer Telangana",
      "verified lawyer Hyderabad",
      "advocate fees Hyderabad",
    ],
    category: "Legal Help",
    readTime: 6,
    publishedDate: "2026-05-01",
    sections: [
      {
        blocks: [
          p("Finding the right lawyer in Hyderabad can feel overwhelming — the city has thousands of advocates across district courts, the Telangana High Court, and numerous tribunals. Whether you are dealing with a property dispute, a criminal matter, a family issue, or a business conflict, selecting the right legal professional is the single most important decision you will make for your case."),
          p("This guide walks you through a step-by-step process for identifying, evaluating, and hiring a qualified advocate in Hyderabad in 2026."),
        ],
      },
      {
        heading: "1. Understand What Kind of Lawyer You Need",
        blocks: [
          p("Indian law is highly specialised. A criminal lawyer who handles bail matters at Nampally Court may have no experience with property registration disputes handled at civil courts. Before you start searching, identify your case type:"),
          ul(
            "Property / land disputes → Civil Lawyer or Property Law Specialist",
            "Criminal cases (FIR, bail, trial) → Criminal Defence Lawyer",
            "Family matters (divorce, custody, maintenance) → Family Law Advocate",
            "Consumer complaints → Consumer Court Lawyer",
            "Employment / labour issues → Labour Law Advocate",
            "Company / startup matters → Corporate Lawyer",
            "GST / income tax disputes → Tax Advocate or Chartered Accountant-Advocate",
          ),
        ],
      },
      {
        heading: "2. Verify Bar Council Registration",
        blocks: [
          p("Every practising advocate in India must be enrolled with a State Bar Council. In Telangana, this is the Bar Council of Telangana. You can verify a lawyer's enrollment number through the Bar Council of India (BCI) portal at barcouncilofindia.org. An unregistered person claiming to be a lawyer is committing fraud."),
          p("Ask for the advocate's enrollment number during your first meeting and cross-check it online. This single step filters out most fraudulent practitioners."),
        ],
      },
      {
        heading: "3. Check Experience and Track Record",
        blocks: [
          p("Years of practice matter, but the type of experience matters more. An advocate with 15 years in property law is more valuable for a land dispute than a 25-year criminal lawyer. Ask directly:"),
          ul(
            "How many similar cases have you handled in the past 3 years?",
            "What is your typical outcome in cases like mine?",
            "Which courts do you primarily appear in?",
            "Can you share references from past clients (with their consent)?",
          ),
        ],
      },
      {
        heading: "4. Understand the Fee Structure",
        blocks: [
          p("Lawyer fees in Hyderabad are not regulated by law — they are negotiated. Common fee structures include:"),
          ul(
            "Consultation fee: ₹500–₹5,000 for the first meeting",
            "Retainer fee: Fixed monthly amount for ongoing representation",
            "Per-appearance fee: Charged each time the lawyer appears in court",
            "Lump-sum fee: Fixed amount for the entire matter",
            "Success fee: A percentage of the settlement (more common in civil suits)",
          ),
          p("Avoid advocates who demand very large upfront payments before reviewing your documents, or who guarantee specific outcomes — no ethical lawyer can guarantee court results."),
        ],
      },
      {
        heading: "5. Use AI Matching Platforms",
        blocks: [
          p("Modern legal tech platforms like LitigaForge AI use AI to match clients with verified advocates based on case type, location, language preference, experience, and budget. This cuts the search time from days to minutes and ensures you only see lawyers who have been verified on the platform."),
          p("You can post your case requirement anonymously, receive match proposals from interested lawyers with AI-calculated match scores (0–100), and then choose whom to contact. This removes much of the uncertainty from the traditional referral-based system."),
        ],
      },
      {
        heading: "6. Red Flags to Avoid",
        blocks: [
          ul(
            "Asks for cash payment with no receipt or agreement",
            "Refuses to give you a copy of documents they file on your behalf",
            "Guarantees a win or a specific judgment",
            "Does not respond to calls or messages for days",
            "Cannot show you their Bar Council enrollment",
            "Asks you to sign blank documents",
          ),
        ],
      },
      {
        heading: "Conclusion",
        blocks: [
          p("Finding a good lawyer in Hyderabad requires due diligence: verify credentials, match specialisation to your case type, understand fees upfront, and trust your instincts about communication. With AI-powered platforms now available, the process is faster and more transparent than ever before."),
        ],
      },
    ],
  },
  {
    slug: "free-legal-aid-telangana-nalsa-guide",
    title: "Free Legal Aid in Telangana: NALSA & TSLSA Complete Guide (2026)",
    description:
      "Who qualifies for free legal aid in Telangana? How to apply through NALSA and TSLSA, DLSA contacts, Lok Adalat dates, and your rights as a beneficiary.",
    keywords: [
      "free legal aid Telangana",
      "NALSA Telangana",
      "TSLSA free lawyer",
      "Lok Adalat Hyderabad",
      "legal aid eligibility India",
      "free advocate Hyderabad",
    ],
    category: "Legal Aid",
    readTime: 5,
    publishedDate: "2026-05-05",
    sections: [
      {
        blocks: [
          p("Access to justice is a fundamental right in India, enshrined in Article 39A of the Constitution. The National Legal Services Authority (NALSA) and the Telangana State Legal Services Authority (TSLSA) ensure that no citizen is denied legal representation because they cannot afford a lawyer."),
          p("If you or someone you know needs a lawyer but cannot pay for one, this guide explains exactly who qualifies, how to apply, and what services you can access for free in Telangana."),
        ],
      },
      {
        heading: "Who Is Eligible for Free Legal Aid?",
        blocks: [
          p("Under the Legal Services Authorities Act, 1987, the following categories of persons are entitled to free legal aid:"),
          ul(
            "Persons with annual income below ₹3,00,000 (three lakh rupees)",
            "Members of Scheduled Castes (SC) and Scheduled Tribes (ST)",
            "Women and children, regardless of income",
            "Persons with disabilities (mental or physical)",
            "Victims of trafficking or begar (bonded labour)",
            "Persons in custody (jail, detention centre, psychiatric hospital)",
            "Industrial workmen in labour disputes",
            "Victims of mass disasters, ethnic violence, or communal violence",
          ),
        ],
      },
      {
        heading: "What Services Does TSLSA Provide?",
        blocks: [
          ul(
            "Free representation by a panel advocate in civil and criminal courts",
            "Legal advice and counselling at Legal Aid Clinics",
            "Mediation and conciliation services",
            "Lok Adalat proceedings for out-of-court settlements",
            "Pre-litigation counselling to avoid unnecessary court battles",
            "Legal literacy camps in villages and urban slums",
          ),
        ],
      },
      {
        heading: "How to Apply for Free Legal Aid in Telangana",
        blocks: [
          p("You can apply for free legal aid through any of these channels:"),
          ul(
            "Visit the District Legal Services Authority (DLSA) office in your district",
            "Call the NALSA helpline: 15100 (toll-free, available during working hours)",
            "Submit an application online at nalsa.gov.in",
            "Contact the nearest Taluk Legal Services Committee",
            "Approach the duty magistrate or legal aid lawyer if you are in custody",
          ),
          p("When visiting the DLSA, bring: your Aadhaar card or any ID proof, income certificate (from tahsildar or MRO), any documents related to your case (FIR copy, notice, contract, etc.), and caste certificate if applying under SC/ST category."),
        ],
      },
      {
        heading: "Lok Adalat — Settle Without Going to Court",
        blocks: [
          p("Lok Adalats are an alternative dispute resolution forum organised by TSLSA and DLSAs. They are especially effective for motor accident claims, matrimonial disputes (excluding divorce), labour disputes, disputes with utility companies (TGSPDCL, HMWSSB), and compoundable criminal offences."),
          p("Awards made by Lok Adalats are final, binding, and not appealable in any court. There is no court fee for cases settled in Lok Adalat, and any court fees already paid are refunded. Lok Adalats are held monthly in Hyderabad and quarterly in district headquarters."),
        ],
      },
      {
        heading: "DLSA Contact Numbers — Telangana",
        blocks: [
          ul(
            "Hyderabad DLSA: Near City Civil Court, Hyderabad — 040-23210305",
            "Rangareddy DLSA: District Courts Complex, Rangareddy — 040-24742929",
            "Medchal-Malkajgiri DLSA: District Court, Medchal — 040-27240116",
            "Sangareddy DLSA: District Courts, Sangareddy — 08455-272020",
            "Warangal DLSA: District Court Complex, Warangal — 0870-2578899",
            "NALSA Toll-Free: 15100",
          ),
        ],
      },
      {
        heading: "Your Rights as a Legal Aid Beneficiary",
        blocks: [
          ul(
            "Right to choose a panel advocate from the approved list",
            "Right to be informed of the progress of your case",
            "Right to change your legal aid advocate if unsatisfied",
            "Right to receive all case documents",
            "Right to lodge a complaint against an advocate with the DLSA",
          ),
          p("Free legal aid in Telangana is not charity — it is your constitutional right. Do not hesitate to claim it if you qualify."),
        ],
      },
    ],
  },
  {
    slug: "file-consumer-forum-complaint-online-india",
    title: "How to File a Consumer Forum Complaint Online in India (2026)",
    description:
      "Step-by-step guide to filing a consumer complaint online via the eDaakhil portal — documents required, forum jurisdiction thresholds, and what to expect.",
    keywords: [
      "consumer forum complaint online India",
      "eDaakhil portal",
      "consumer court complaint",
      "NCDRC complaint",
      "file consumer complaint India",
      "consumer protection act 2019",
    ],
    category: "Consumer Rights",
    readTime: 7,
    publishedDate: "2026-05-10",
    sections: [
      {
        blocks: [
          p("The Consumer Protection Act, 2019 is one of the most powerful laws available to ordinary citizens in India. If you have been cheated by a seller, received a defective product, suffered deficiency in service from a bank, hospital, builder, insurance company, or any other service provider — you can file a formal complaint with a consumer forum and seek compensation."),
          p("Since 2020, the government has made it possible to file consumer complaints entirely online through the eDaakhil portal (edaakhil.nic.in), without needing to visit a court in person."),
        ],
      },
      {
        heading: "Which Consumer Forum Has Jurisdiction Over Your Case?",
        blocks: [
          p("The Consumer Protection Act, 2019 (amended 2021) sets monetary limits for each forum:"),
          ul(
            "District Consumer Disputes Redressal Commission (DCDRC): Claims up to ₹50 lakhs",
            "State Consumer Disputes Redressal Commission (SCDRC): Claims between ₹50 lakhs and ₹2 crores",
            "National Consumer Disputes Redressal Commission (NCDRC): Claims above ₹2 crores",
          ),
          p("For most everyday disputes — defective electronics, builder delays, insurance rejections, hospital billing issues — the District Forum is where you will file. You can file in the district where you live, where the seller/company operates, or where the transaction took place."),
        ],
      },
      {
        heading: "Documents You Need Before Filing",
        blocks: [
          ul(
            "Proof of purchase: Receipt, invoice, order confirmation, screenshot",
            "Proof of payment: Bank statement, UPI receipt, credit card statement",
            "Evidence of defect or deficiency: Photos, videos, test reports, doctor's certificate",
            "Communication records: Emails, WhatsApp messages, complaint ticket numbers",
            "Proof of loss: Medical bills, hotel stay, travel costs, repair estimates",
            "Aadhaar card or any government-issued photo ID",
          ),
        ],
      },
      {
        heading: "Step-by-Step: Filing on eDaakhil Portal",
        blocks: [
          ul(
            "Step 1: Go to edaakhil.nic.in and click 'Register as Consumer'",
            "Step 2: Create your account using mobile number and email ID",
            "Step 3: Log in and click 'File New Complaint'",
            "Step 4: Select the appropriate commission (District/State/National)",
            "Step 5: Fill in complaint details — opposite party name, address, nature of grievance",
            "Step 6: Enter relief sought (refund, compensation, replacement, apology)",
            "Step 7: Upload all supporting documents (PDF format, max 5MB each)",
            "Step 8: Pay the prescribed filing fee online (varies by claim amount — starts from ₹200)",
            "Step 9: Submit and note your complaint registration number",
            "Step 10: Track your case online using the registration number",
          ),
        ],
      },
      {
        heading: "Filing Fee Structure",
        blocks: [
          ul(
            "Claims up to ₹5 lakhs: ₹200",
            "Claims from ₹5 lakhs to ₹10 lakhs: ₹400",
            "Claims from ₹10 lakhs to ₹20 lakhs: ₹500",
            "Claims from ₹20 lakhs to ₹50 lakhs: ₹2,000",
            "SC/ST complainants: Fully exempt from filing fee",
          ),
        ],
      },
      {
        heading: "What Happens After Filing?",
        blocks: [
          p("After your complaint is accepted, the forum issues a notice to the opposite party (the seller or service provider), who has 30 days to respond. The forum then schedules hearings. Most district-level cases are resolved within 3–5 months, though complex matters can take longer."),
          p("You do not need a lawyer to appear in consumer forums — you can represent yourself. However, for complex cases involving large amounts, builder disputes, or medical negligence, having a consumer law advocate significantly improves your chances."),
          p("If the judgment is in your favour, the forum can order a refund, replacement, compensation for physical/mental harm, and even punitive damages. Non-compliance by the company can result in imprisonment."),
        ],
      },
      {
        heading: "Common Complaints Successfully Resolved",
        blocks: [
          ul(
            "Builder not delivering flat on time (RERA + consumer forum)",
            "Insurance claim rejection without valid reason",
            "Defective vehicle or appliance not replaced under warranty",
            "Hospital overcharging or medical negligence",
            "Airline or train ticket refund denied",
            "E-commerce platform refusing to replace defective goods",
            "Bank mis-selling insurance or charging unauthorised fees",
          ),
        ],
      },
    ],
  },
  {
    slug: "rera-property-buyers-andhra-pradesh",
    title: "Understanding RERA for Property Buyers in Andhra Pradesh (2026)",
    description:
      "Everything AP homebuyers need to know about RERA AP — project registration, buyer rights, how to check project status, and how to file a complaint against a builder.",
    keywords: [
      "RERA Andhra Pradesh",
      "RERA AP property buyers",
      "AP RERA complaint",
      "builder dispute AP",
      "RERA registration check AP",
      "property buyers rights Andhra Pradesh",
    ],
    category: "Property Law",
    readTime: 6,
    publishedDate: "2026-05-15",
    sections: [
      {
        blocks: [
          p("The Real Estate (Regulation and Development) Act, 2016 (RERA) is one of the most important reforms for homebuyers in India. In Andhra Pradesh, the RERA Authority — AP RERA — is the regulatory body that governs real estate projects and agents, and resolves disputes between buyers and builders."),
          p("If you are buying a flat, villa, or plot in Amaravati, Vijayawada, Visakhapatnam, or anywhere else in Andhra Pradesh, understanding your rights under RERA AP is essential before signing any agreement."),
        ],
      },
      {
        heading: "What Projects Must Be Registered Under RERA AP?",
        blocks: [
          p("Under the Act, the following real estate projects must be registered with AP RERA before the promoter can advertise or sell units:"),
          ul(
            "Residential projects with more than 8 units or plot area exceeding 500 sq. metres",
            "Commercial projects of any size offered for sale",
            "Mixed-use developments (residential + commercial)",
            "Ongoing projects where completion certificate had not been obtained before RERA commencement",
          ),
          p("Always verify that a project is registered on the AP RERA website (rera.ap.gov.in) before paying any booking amount. Unregistered projects are illegal and offer you no RERA protection."),
        ],
      },
      {
        heading: "How to Check Project Registration on AP RERA",
        blocks: [
          ul(
            "Step 1: Go to rera.ap.gov.in",
            "Step 2: Click on 'Projects' in the top navigation",
            "Step 3: Search by project name, promoter name, or RERA registration number",
            "Step 4: View project details — registration date, expiry, approved plan, completion date",
            "Step 5: Download the project's approved layout and sanctioned plan",
          ),
        ],
      },
      {
        heading: "Your Rights as a Homebuyer Under RERA AP",
        blocks: [
          ul(
            "Right to receive complete project information before booking",
            "Right to get all project documents — approved plans, layout, commencement certificate",
            "Right to withdraw if possession is not given on time and claim full refund with interest",
            "Right to claim compensation for structural defects within 5 years of possession",
            "Right to know about any changes to the approved plan before they are made",
            "Right to form a homebuyers' association after the project is completed",
            "Right to approach AP RERA for dispute resolution without filing a civil suit",
          ),
        ],
      },
      {
        heading: "Common Builder Violations and What You Can Do",
        blocks: [
          ul(
            "Delayed possession beyond agreed date → Claim compensation or full refund",
            "Changes to approved plan without consent → File RERA complaint",
            "Failure to hand over common areas → RERA can direct handover",
            "Poor construction quality / structural defects → Compensation under RERA",
            "Builder not maintaining the project during development → RERA intervention",
            "Selling without RERA registration → Builder liable to imprisonment up to 3 years",
          ),
        ],
      },
      {
        heading: "How to File a Complaint with AP RERA",
        blocks: [
          p("Filing a RERA complaint is simpler and faster than going to a civil court. You can file online at rera.ap.gov.in by creating an account, submitting your complaint form with supporting documents (agreement for sale, payment receipts, builder correspondence), and paying a nominal filing fee."),
          p("AP RERA is required to adjudicate complaints within 60 days. If the RERA Authority's order is not complied with by the builder, the buyer can recover the amount as arrears of land revenue — giving the order the force of a government decree."),
        ],
      },
      {
        heading: "RERA AP vs Consumer Forum vs Civil Court",
        blocks: [
          p("RERA offers a faster, specialised remedy specifically for real estate disputes. Consumer forums are also available for homebuyers and often run concurrently with RERA proceedings — the Supreme Court has held that buyers can approach both forums simultaneously. Civil courts are generally the slowest option and should be the last resort."),
          p("For any property dispute in Andhra Pradesh, consult a property law advocate who specialises in RERA matters and has experience appearing before AP RERA and NCDRC."),
        ],
      },
    ],
  },
  {
    slug: "check-court-case-status-ecourts-india",
    title: "How to Check Your Court Case Status Online in India — eCourts Guide (2026)",
    description:
      "Use eCourts India to track your case status, find next hearing dates, download orders, and look up cases by CNR number, case number, or party name — complete guide for 2026.",
    keywords: [
      "eCourts India case status",
      "check court case status online India",
      "CNR number eCourts",
      "eCourts portal India",
      "court case tracking India",
      "how to find court date India",
    ],
    category: "Court Procedures",
    readTime: 5,
    publishedDate: "2026-05-20",
    sections: [
      {
        blocks: [
          p("The eCourts India project is a government initiative that has digitised case records across all district and subordinate courts in India. Through the eCourts portal (ecourts.gov.in) and its mobile app, any citizen can now track the status of a court case, find the next hearing date, and even download court orders — all for free, without visiting the court."),
          p("This guide explains the different ways to search for a case on eCourts in 2026."),
        ],
      },
      {
        heading: "What Is a CNR Number?",
        blocks: [
          p("A Case Number Record (CNR) is a unique 16-digit identifier assigned to every case filed in a district or subordinate court in India. It has the format: STATE-COURT-CASENUMBER-YEAR. Example: TSHYD012345672024 (Telangana, Hyderabad, Case 1234567, 2024)."),
          p("The CNR number is the fastest and most reliable way to track a case because it uniquely identifies one case across the entire eCourts system. Always note down your CNR number when your case is filed."),
        ],
      },
      {
        heading: "How to Check Case Status on eCourts (Web)",
        blocks: [
          ul(
            "Step 1: Go to ecourts.gov.in",
            "Step 2: Click on 'Case Status' in the main menu",
            "Step 3: Select your State and District",
            "Step 4: Choose search method: CNR Number, Case Number, Party Name, Advocate Name, or Act",
            "Step 5: Enter the relevant details and solve the CAPTCHA",
            "Step 6: Click 'Search' to view the case status, next hearing date, and court orders",
          ),
        ],
      },
      {
        heading: "Using the eCourts Mobile App",
        blocks: [
          p("The eCourts Services mobile app is available on Android (Google Play) and iOS (App Store). It supports all the same search options as the web portal and additionally offers push notifications when a hearing date is scheduled or changed — useful so you never miss a critical date."),
          ul(
            "Search by CNR, case number, party name, advocate name",
            "View daily cause lists for any court in India",
            "Download certified copies of court orders (charges apply)",
            "Check Lok Adalat schedules",
            "Find court location and contact details",
          ),
        ],
      },
      {
        heading: "Searching by Party Name",
        blocks: [
          p("If you do not have the CNR or case number, you can search by your own name or the opposite party's name. On the eCourts portal, select 'Party Name' as the search type, enter the first and last name, and filter by state and district. This is useful when tracking cases filed against you that you were not officially notified about."),
          p("Note that common names may return multiple results. Always cross-verify by checking the petitioner/respondent names, case type, and filing date."),
        ],
      },
      {
        heading: "How to Track High Court Cases",
        blocks: [
          p("eCourts.gov.in only covers district and subordinate courts. For High Court cases:"),
          ul(
            "Telangana High Court: hctas.gov.in",
            "Andhra Pradesh High Court: hcap.nic.in",
            "Supreme Court of India: sci.gov.in (LIMBS portal for case tracking)",
          ),
          p("Each High Court has its own portal with case search, cause list, and order download features."),
        ],
      },
      {
        heading: "Downloading Orders and Judgments",
        blocks: [
          p("On the eCourts portal, after finding your case, you can view all orders passed in that case. Many courts now upload scanned copies of orders within 24–48 hours of being pronounced. You can download these for free."),
          p("For certified copies (which have legal value for appeals and other proceedings), you need to apply through the portal and pay a nominal fee. Certified copies are typically ready within 3–7 working days."),
          p("LitigaForge AI's Judgment Finder also allows you to search for relevant case law and Supreme Court/High Court precedents by legal topic, which complements the case tracking features of eCourts."),
        ],
      },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find(a => a.slug === slug);
}
