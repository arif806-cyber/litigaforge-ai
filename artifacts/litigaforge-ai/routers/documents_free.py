"""Free Legal Document Templates — fill-in + AI generate + download."""
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from typing import List, Dict, Any
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ai_brain import _call_claude, _call_openai, _call_gemini, get_active_providers
from ai_safety import safe_ai_output

router = APIRouter(prefix="/documents/free", tags=["Free Documents"])


class TemplateField(BaseModel):
    name: str
    label: str
    type: str = "text"           # text, textarea, number, date, select
    placeholder: str = ""
    required: bool = True
    options: List[str] = []     # for select type
    help_text: str = ""


class DocumentTemplate(BaseModel):
    slug: str
    title: str
    description: str
    category: str
    icon: str
    fields: List[TemplateField]
    ai_prompt_template: str
    estimated_time: str = "5 min"


TEMPLATES: List[DocumentTemplate] = [
    DocumentTemplate(
        slug="rent-agreement",
        title="Residential Rent Agreement",
        description="Standard 11-month rent agreement for Telangana & AP. Includes security deposit, maintenance, and lock-in clauses.",
        category="Property",
        icon="Home",
        estimated_time="5 min",
        fields=[
            TemplateField(name="landlord_name", label="Landlord Full Name", placeholder="Ramesh Kumar Sharma"),
            TemplateField(name="tenant_name", label="Tenant Full Name", placeholder="Priya Devi"),
            TemplateField(name="property_address", label="Property Address", type="textarea", placeholder="Flat 302, Green Valley Apartments, Road No. 4, Banjara Hills, Hyderabad, TG - 500034"),
            TemplateField(name="monthly_rent", label="Monthly Rent (INR)", type="number", placeholder="15000"),
            TemplateField(name="security_deposit", label="Security Deposit (INR)", type="number", placeholder="45000"),
            TemplateField(name="lease_duration", label="Lease Duration", type="select", options=["11 months", "1 year", "2 years", "3 years"], placeholder="11 months"),
            TemplateField(name="start_date", label="Agreement Start Date", type="date"),
            TemplateField(name="maintenance", label="Monthly Maintenance (INR)", type="number", placeholder="2000", required=False),
            TemplateField(name="purpose", label="Purpose of Use", type="select", options=["Residential", "Commercial", "Mixed"], placeholder="Residential"),
            TemplateField(name="lock_in", label="Lock-in Period (months)", type="number", placeholder="6", required=False, help_text="Minimum period tenant cannot vacate"),
        ],
        ai_prompt_template="""You are a legal document drafter for Indian tenancy law. Generate a formal, legally sound Residential Rent Agreement in plain English suitable for Telangana/Andhra Pradesh.

PARTIES:
- Landlord: {landlord_name}
- Tenant: {tenant_name}

PROPERTY:
{property_address}

TERMS:
- Monthly Rent: INR {monthly_rent}
- Security Deposit: INR {security_deposit}
- Lease Duration: {lease_duration}
- Start Date: {start_date}
- Purpose: {purpose}
- Maintenance: INR {maintenance}
- Lock-in Period: {lock_in} months

STRUCTURE the document with these numbered sections:
1. Parties and Premises
2. Term and Rent
3. Security Deposit
4. Maintenance and Utilities
5. Use and Occupancy
6. Lock-in and Notice
7. Termination
8. Dispute Resolution (Hyderabad jurisdiction)
9. General Clauses
10. Signatures

Make it sound official and enforceable under the Telangana Building (Lease, Rent and Eviction) Control Act and the Indian Contract Act, 1872. Use "hereinafter referred to as..." for parties. Add a stamp duty note. Output as plain text, no markdown."""
    ),
    DocumentTemplate(
        slug="legal-notice",
        title="Legal Notice / Demand Letter",
        description="Formal legal notice for recovery of money, breach of contract, or other civil disputes. Suitable for filing in Telangana/AP courts.",
        category="Civil",
        icon="Mail",
        estimated_time="4 min",
        fields=[
            TemplateField(name="sender_name", label="Your Full Name", placeholder="Rajesh Gupta"),
            TemplateField(name="sender_address", label="Your Address", type="textarea", placeholder="42, Saroor Nagar, Hyderabad, TG - 500035"),
            TemplateField(name="recipient_name", label="Recipient Full Name", placeholder="Amit Singh"),
            TemplateField(name="recipient_address", label="Recipient Address", type="textarea", placeholder="55, Himayath Nagar, Hyderabad, TG - 500029"),
            TemplateField(name="subject", label="Subject of Notice", placeholder="Demand for Payment of Outstanding Rent"),
            TemplateField(name="cause", label="Cause of Action", type="textarea", placeholder="Non-payment of rent for 3 months (March, April, May 2026) totaling INR 45,000"),
            TemplateField(name="demand_amount", label="Amount Demanded (INR)", type="number", placeholder="45000", required=False),
            TemplateField(name="relief_sought", label="Relief Sought", type="textarea", placeholder="Payment of INR 45,000 within 15 days, failing which legal action will be initiated"),
            TemplateField(name="reply_days", label="Reply Time (days)", type="number", placeholder="15"),
            TemplateField(name="date", label="Date of Notice", type="date"),
            TemplateField(name="advocate_name", label="Advocate Name (if sending via lawyer)", placeholder="Adv. Sunita Reddy", required=False),
            TemplateField(name="advocate_address", label="Advocate Address", type="textarea", required=False),
        ],
        ai_prompt_template="""Draft a formal Legal Notice under the Indian legal system for Telangana/Andhra Pradesh.

SENDER: {sender_name}, {sender_address}
RECIPIENT: {recipient_name}, {recipient_address}
SUBJECT: {subject}
CAUSE: {cause}
AMOUNT DEMANDED: INR {demand_amount}
RELIEF SOUGHT: {relief_sought}
REPLY WITHIN: {reply_days} days
DATE: {date}
ADVOCATE: {advocate_name}, {advocate_address}

Include these sections:
1. Reference to Advocate (if provided)
2. Subject Line
3. Facts of the Case
4. Legal Basis (cite relevant sections of CPC, Contract Act, or specific state law)
5. Specific Demand
6. Consequences of Non-Compliance
7. Reply Deadline
8. Disclaimer of liability
9. Signature block

Make it sound authoritative but not threatening. Use formal legal Indian English. Output as plain text."""
    ),
    DocumentTemplate(
        slug="power-of-attorney",
        title="General Power of Attorney",
        description="Authorize someone to act on your behalf for property, bank, or legal matters. Valid across India with notarization note.",
        category="Property",
        icon="FileKey",
        estimated_time="4 min",
        fields=[
            TemplateField(name="principal_name", label="Principal (Grantor) Name", placeholder="Krishna Murthy"),
            TemplateField(name="principal_address", label="Principal Address", type="textarea", placeholder="H.No. 12-5-88, Kukatpally, Hyderabad, TG - 500072"),
            TemplateField(name="agent_name", label="Agent (Attorney) Name", placeholder="Lakshmi Devi"),
            TemplateField(name="agent_address", label="Agent Address", type="textarea", placeholder="H.No. 3-4-102, Begumpet, Hyderabad, TG - 500016"),
            TemplateField(name="purpose", label="Purpose / Powers Granted", type="textarea", placeholder="To manage property at 12-5-88, collect rent, pay taxes, sign documents, and represent before government offices"),
            TemplateField(name="start_date", label="Effective Date", type="date"),
            TemplateField(name="duration", label="Duration", type="select", options=["Until revoked", "1 year", "2 years", "3 years", "Specific event"], placeholder="Until revoked"),
            TemplateField(name="property_details", label="Property Details (if applicable)", type="textarea", placeholder="Plot 45, Survey No. 88, Kukatpally, Hyderabad", required=False),
            TemplateField(name="witness1", label="Witness 1 Name", placeholder="Suresh Babu", required=False),
            TemplateField(name="witness2", label="Witness 2 Name", placeholder="Geetha Rani", required=False),
        ],
        ai_prompt_template="""Draft a General Power of Attorney under the Indian Powers of Attorney Act, 1882.

PRINCIPAL: {principal_name}, {principal_address}
AGENT: {agent_name}, {agent_address}
PURPOSE: {purpose}
EFFECTIVE: {start_date}
DURATION: {duration}
PROPERTY: {property_details}
WITNESSES: {witness1}, {witness2}

Include:
1. Preamble citing the Act
2. Appointment clause
3. Enumerated powers (general + specific to purpose)
4. Duration and Revocation
5. Indemnity clause
6. Ratification clause
7. Witness clause
8. Notarization requirement note
9. Registration note (if property-related, mention Sub-Registrar)

Formal Indian legal language. Output plain text."""
    ),
    DocumentTemplate(
        slug="affidavit",
        title="Self-Declaration / Affidavit",
        description="Sworn statement for address proof, income declaration, name change, or any purpose. Includes notarization instructions.",
        category="General",
        icon="FileCheck",
        estimated_time="3 min",
        fields=[
            TemplateField(name="deponent_name", label="Deponent Full Name", placeholder="Mohammed Ali Khan"),
            TemplateField(name="deponent_address", label="Deponent Address", type="textarea", placeholder="Flat 7, Mehdipatnam, Hyderabad, TG - 500028"),
            TemplateField(name="age", label="Age", type="number", placeholder="34"),
            TemplateField(name="occupation", label="Occupation", placeholder="Software Engineer"),
            TemplateField(name="purpose", label="Purpose of Affidavit", type="select", options=["Address Proof", "Income Declaration", "Name Change", "Date of Birth Correction", "Relationship Proof", "Character Certificate", "Other"], placeholder="Address Proof"),
            TemplateField(name="declaration", label="Specific Declaration", type="textarea", placeholder="I solemnly declare that I am residing at the above address since January 2020 and all documents submitted are true to my knowledge."),
            TemplateField(name="date", label="Date", type="date"),
            TemplateField(name="place", label="Place", placeholder="Hyderabad"),
            TemplateField(name="before_whom", label="Before Whom", type="select", options=["Notary Public", "Oath Commissioner", "Magistrate", "Executive Magistrate"], placeholder="Notary Public"),
        ],
        ai_prompt_template="""Draft an Affidavit / Self-Declaration under Indian law for Telangana.

DEPONENT: {deponent_name}, Age {age}, Occupation: {occupation}
ADDRESS: {deponent_address}
PURPOSE: {purpose}
DECLARATION: {declaration}
DATE: {date}
PLACE: {place}
BEFORE: {before_whom}

Structure:
1. Title
2. Depponent details
3. Purpose preamble
4. Numbered paragraphs of facts/declarations
5. Verification clause ("I, the above-named deponent, do hereby verify and state that...")
6. Truth declaration
7. Signature block
8. Notary/Commissioner attestation block
9. Stamp duty note (Rs. 20-50 for affidavit in TG)

Use standard Indian affidavit format. Output plain text."""
    ),
    DocumentTemplate(
        slug="nda",
        title="Non-Disclosure Agreement (NDA)",
        description="Protect confidential business information when sharing with employees, vendors, or partners. Indian law compliant.",
        category="Business",
        icon="Shield",
        estimated_time="5 min",
        fields=[
            TemplateField(name="disclosing_party", label="Disclosing Party (Company)", placeholder="TechForge Solutions Pvt. Ltd."),
            TemplateField(name="disclosing_address", label="Disclosing Party Address", type="textarea", placeholder="3rd Floor, Cyber Towers, Hitec City, Hyderabad, TG - 500081"),
            TemplateField(name="receiving_party", label="Receiving Party", placeholder="Arjun Reddy"),
            TemplateField(name="receiving_address", label="Receiving Party Address", type="textarea", placeholder="Flat 201, Madhapur, Hyderabad, TG - 500081"),
            TemplateField(name="purpose", label="Purpose of Disclosure", placeholder="Evaluation of software product for potential partnership"),
            TemplateField(name="confidential_info", label="Description of Confidential Info", type="textarea", placeholder="Source code, business plans, customer lists, financial projections, technical specifications"),
            TemplateField(name="duration_years", label="Confidentiality Duration (years)", type="number", placeholder="3"),
            TemplateField(name="jurisdiction", label="Jurisdiction City", placeholder="Hyderabad"),
            TemplateField(name="date", label="Date", type="date"),
        ],
        ai_prompt_template="""Draft a One-Way Non-Disclosure Agreement under Indian Contract Act, 1872 and IT Act, 2000.

DISCLOSING: {disclosing_party}, {disclosing_address}
RECEIVING: {receiving_party}, {receiving_address}
PURPOSE: {purpose}
CONFIDENTIAL INFO: {confidential_info}
DURATION: {duration_years} years
JURISDICTION: {jurisdiction}
DATE: {date}

Include:
1. Definitions
2. Obligations of Receiving Party
3. Permitted Disclosures
4. Return of Information
5. Remedies (injunctive relief + damages)
6. Governing Law (Indian law, {jurisdiction} jurisdiction)
7. Severability
8. Entire Agreement
9. Signature blocks for both parties + witnesses

Professional tone. Output plain text."""
    ),
    DocumentTemplate(
        slug="will",
        title="Simple Will / Testament",
        description="Basic will for distribution of assets. Includes executor appointment and witness requirements under Indian Succession Act.",
        category="Family",
        icon="Scroll",
        estimated_time="6 min",
        fields=[
            TemplateField(name="testator_name", label="Testator Full Name", placeholder="Venkata Rao"),
            TemplateField(name="testator_address", label="Testator Address", type="textarea", placeholder="12, Srinagar Colony, Hyderabad, TG - 500073"),
            TemplateField(name="age", label="Age", type="number", placeholder="68"),
            TemplateField(name="executor_name", label="Executor Name", placeholder="Ravi Kumar (son)"),
            TemplateField(name="executor_address", label="Executor Address", type="textarea", placeholder="Same as testator"),
            TemplateField(name="beneficiaries", label="Beneficiaries & Assets", type="textarea", placeholder="1. House at Srinagar Colony to son Ravi Kumar\n2. Bank deposits (approx. 15 lakhs) divided equally between daughters Priya and Lakshmi\n3. Gold jewelry to wife Sita Devi"),
            TemplateField(name="residue", label="Residue Clause (remaining assets)", type="textarea", placeholder="All remaining assets to be divided equally among all children"),
            TemplateField(name="revocation", label="Revocation of Previous Wills", type="select", options=["Yes, revoke all previous wills", "No, this is my first will"], placeholder="Yes, revoke all previous wills"),
            TemplateField(name="date", label="Date", type="date"),
            TemplateField(name="place", label="Place", placeholder="Hyderabad"),
            TemplateField(name="witness1", label="Witness 1 Name", placeholder="Dr. Rajesh Sharma"),
            TemplateField(name="witness2", label="Witness 2 Name", placeholder="Mrs. Geetha Reddy"),
        ],
        ai_prompt_template="""Draft a Simple Will under the Indian Succession Act, 1925 (for Hindus, Buddhists, Sikhs, Jains — mention amendment).

TESTATOR: {testator_name}, Age {age}, {testator_address}
EXECUTOR: {executor_name}, {executor_address}
BENEFICIARIES: {beneficiaries}
RESIDUE: {residue}
REVOCATION: {revocation}
DATE: {date}
PLACE: {place}
WITNESSES: {witness1}, {witness2}

Include:
1. Preamble (sound mind, voluntary)
2. Revocation clause
3. Funeral wishes (optional standard)
4. Specific bequests (numbered)
5. Residue clause
6. Executor powers
7. Contingency clause (if beneficiary predeceases)
8. Execution clause
9. Witness attestation (3 required for Indian law)
10. Registration note (optional but recommended)

Warm but legally precise tone. Output plain text."""
    ),
    DocumentTemplate(
        slug="consumer-complaint",
        title="Consumer Complaint Letter",
        description="Formal complaint to company/shop for defective product, poor service, or refund. Ready to send or attach to District Forum complaint.",
        category="Consumer",
        icon="MessageCircleWarning",
        estimated_time="4 min",
        fields=[
            TemplateField(name="complainant_name", label="Your Full Name", placeholder="Anil Kumar"),
            TemplateField(name="complainant_address", label="Your Address", type="textarea", placeholder="45, Ameerpet, Hyderabad, TG - 500016"),
            TemplateField(name="company_name", label="Company / Seller Name", placeholder="ElectroMart Pvt. Ltd."),
            TemplateField(name="company_address", label="Company Address", type="textarea", placeholder="Forum Sujana Mall, Kukatpally, Hyderabad, TG - 500072"),
            TemplateField(name="product_service", label="Product / Service Details", placeholder="Samsung 55\" 4K Smart TV, Model UA55CU8000"),
            TemplateField(name="purchase_date", label="Purchase Date", type="date"),
            TemplateField(name="amount", label="Amount Paid (INR)", type="number", placeholder="42999"),
            TemplateField(name="invoice_no", label="Invoice / Receipt No.", placeholder="ELM-2026-05432"),
            TemplateField(name="issue", label="Nature of Complaint", type="textarea", placeholder="TV developed vertical lines on screen within 15 days of purchase. Company refusing replacement despite warranty."),
            TemplateField(name="remedy", label="Remedy Sought", type="select", options=["Refund", "Replacement", "Repair", "Compensation", "Apology + Service"], placeholder="Replacement"),
            TemplateField(name="demand_amount", label="Compensation Amount (if any)", type="number", placeholder="50000", required=False, help_text="Only if seeking compensation"),
            TemplateField(name="date", label="Date", type="date"),
            TemplateField(name="days_notice", label="Notice Period (days)", type="number", placeholder="15"),
        ],
        ai_prompt_template="""Draft a formal Consumer Complaint Letter under the Consumer Protection Act, 2019 for Telangana.

COMPLAINANT: {complainant_name}, {complainant_address}
AGAINST: {company_name}, {company_address}
PRODUCT: {product_service}
PURCHASED: {purchase_date}, Amount: INR {amount}
INVOICE: {invoice_no}
ISSUE: {issue}
REMEDY SOUGHT: {remedy}
COMPENSATION: INR {demand_amount}
DATE: {date}
NOTICE PERIOD: {days_notice} days

Include:
1. Sender and recipient addresses
2. Subject line
3. Reference to Consumer Protection Act, 2019
4. Chronology of events
5. Legal basis (deficiency in service, unfair trade practice)
6. Specific demands with deadline
7. Consequences (District Consumer Forum, State Commission)
8. Document reference list
9. Professional closing

Assertive but professional tone. Output plain text."""
    ),
    DocumentTemplate(
        slug="termination-letter",
        title="Employee Termination Letter",
        description="Formal termination letter for misconduct, performance, or layoff. Includes notice period and final settlement details.",
        category="Business",
        icon="UserMinus",
        estimated_time="4 min",
        fields=[
            TemplateField(name="employer_name", label="Employer / Company Name", placeholder="Infosys Limited"),
            TemplateField(name="employer_address", label="Company Address", type="textarea", placeholder="Plot No. 26, Hitec City, Hyderabad, TG - 500081"),
            TemplateField(name="employee_name", label="Employee Full Name", placeholder="Sandeep Verma"),
            TemplateField(name="employee_id", label="Employee ID", placeholder="EMP-HYD-4521"),
            TemplateField(name="designation", label="Designation", placeholder="Senior Software Engineer"),
            TemplateField(name="department", label="Department", placeholder="Digital Engineering"),
            TemplateField(name="date_of_joining", label="Date of Joining", type="date"),
            TemplateField(name="termination_date", label="Effective Termination Date", type="date"),
            TemplateField(name="reason", label="Reason for Termination", type="select", options=["Misconduct", "Poor Performance", "Layoff / Restructuring", "Mutual Separation", "Absconding", "Other"], placeholder="Misconduct"),
            TemplateField(name="reason_details", label="Details of Reason", type="textarea", placeholder="Repeated unauthorized absence for 10 consecutive working days (March 1-12, 2026) without prior approval or intimation."),
            TemplateField(name="notice_period", label="Notice Period Served (months)", type="number", placeholder="1", required=False),
            TemplateField(name="final_settlement", label="Final Settlement Details", type="textarea", placeholder="Salary till March 15, 2026 + encashed leave (12 days) + gratuity (if applicable) will be processed within 30 days."),
            TemplateField(name="date", label="Date of Letter", type="date"),
        ],
        ai_prompt_template="""Draft a formal Employee Termination Letter under Indian labour law (ID Act, 1947; Shops Act; or state-specific).

EMPLOYER: {employer_name}, {employer_address}
EMPLOYEE: {employee_name}, ID: {employee_id}
DESIGNATION: {designation}, {department}
DOJ: {date_of_joining}
TERMINATION DATE: {termination_date}
REASON: {reason} — {reason_details}
NOTICE PERIOD: {notice_period} months
SETTLEMENT: {final_settlement}
DATE: {date}

Include:
1. Company letterhead style opening
2. Reference to employment records
3. Clear statement of termination with effective date
4. Detailed reason with facts
5. Compliance with notice period / payment in lieu
6. Final settlement breakdown
7. Return of company property
8. Confidentiality reminder
9. Reference to internal policies / standing orders
10. Professional closing with HR signature block

Formal HR tone, legally cautious. Output plain text."""
    ),
    DocumentTemplate(
        slug="promissory-note",
        title="Promissory Note",
        description="Simple IOU for personal loans between friends/family. Includes repayment schedule and default consequences.",
        category="Finance",
        icon="Receipt",
        estimated_time="3 min",
        fields=[
            TemplateField(name="maker_name", label="Borrower (Maker) Name", placeholder="Ravi Teja"),
            TemplateField(name="maker_address", label="Borrower Address", type="textarea", placeholder="11, Jubilee Hills, Hyderabad, TG - 500033"),
            TemplateField(name="payee_name", label="Lender (Payee) Name", placeholder="Suresh Babu"),
            TemplateField(name="payee_address", label="Lender Address", type="textarea", placeholder="22, Banjara Hills, Hyderabad, TG - 500034"),
            TemplateField(name="principal_amount", label="Principal Amount (INR)", type="number", placeholder="200000"),
            TemplateField(name="interest_rate", label="Interest Rate (% per annum)", type="number", placeholder="12", required=False, help_text="Leave 0 for no interest"),
            TemplateField(name="repayment_date", label="Repayment Due Date", type="date"),
            TemplateField(name="repayment_terms", label="Repayment Terms", type="select", options=["Lump sum on due date", "Monthly EMI", "Quarterly installments", "On demand"], placeholder="Lump sum on due date"),
            TemplateField(name="emi_amount", label="EMI Amount (if applicable)", type="number", placeholder="", required=False),
            TemplateField(name="security", label="Security / Collateral", type="textarea", placeholder="No collateral. Pure personal loan based on trust.", required=False),
            TemplateField(name="date", label="Date", type="date"),
            TemplateField(name="place", label="Place", placeholder="Hyderabad"),
        ],
        ai_prompt_template="""Draft a Promissory Note under the Negotiable Instruments Act, 1881 (as an acknowledgement of debt, not negotiable instrument per se).

MAKER (Borrower): {maker_name}, {maker_address}
PAYEE (Lender): {payee_name}, {payee_address}
PRINCIPAL: INR {principal_amount}
INTEREST: {interest_rate}% p.a.
DUE DATE: {repayment_date}
TERMS: {repayment_terms}
EMI: INR {emi_amount}
SECURITY: {security}
DATE: {date}
PLACE: {place}

Include:
1. Unconditional promise to pay
2. Principal + interest calculation
3. Repayment schedule
4. Default clause (interest on overdue, legal action)
5. Governing law (Indian Contract Act)
6. Witnesses (2)
7. Stamp duty note (Rs. 10-50 depending on amount in TG)

Simple but legally sound. Output plain text."""
    ),
    DocumentTemplate(
        slug="lease-commercial",
        title="Commercial Lease Agreement",
        description="Lease for shop, office, or warehouse space. Includes rent escalation, subletting, and lock-in terms.",
        category="Property",
        icon="Building2",
        estimated_time="6 min",
        fields=[
            TemplateField(name="landlord_name", label="Landlord Name", placeholder="Sri Venkateswara Developers"),
            TemplateField(name="landlord_address", label="Landlord Address", type="textarea", placeholder="5th Floor, Abids, Hyderabad, TG - 500001"),
            TemplateField(name="tenant_name", label="Tenant / Business Name", placeholder="Green Earth Organics Pvt. Ltd."),
            TemplateField(name="tenant_address", label="Tenant Address", type="textarea", placeholder="Same as leased property"),
            TemplateField(name="property_address", label="Leased Property Address", type="textarea", placeholder="Shop No. 12, Ground Floor, GVK One Mall, Banjara Hills, Hyderabad, TG - 500034"),
            TemplateField(name="area_sqft", label="Area (sq. ft.)", type="number", placeholder="850"),
            TemplateField(name="monthly_rent", label="Monthly Rent (INR)", type="number", placeholder="75000"),
            TemplateField(name="security_deposit", label="Security Deposit (INR)", type="number", placeholder="300000"),
            TemplateField(name="lease_term", label="Lease Term", type="select", options=["1 year", "3 years", "5 years", "10 years"], placeholder="3 years"),
            TemplateField(name="start_date", label="Start Date", type="date"),
            TemplateField(name="business_type", label="Business Type", placeholder="Organic grocery retail store"),
            TemplateField(name="escalation", label="Annual Rent Escalation (%)", type="number", placeholder="5", required=False),
            TemplateField(name="lock_in", label="Lock-in Period (years)", type="number", placeholder="2", required=False),
            TemplateField(name="maintenance", label="Maintenance Charges (INR/month)", type="number", placeholder="5000", required=False),
        ],
        ai_prompt_template="""Draft a Commercial Lease Agreement for Telangana under the Indian Contract Act and Transfer of Property Act.

LANDLORD: {landlord_name}, {landlord_address}
TENANT: {tenant_name}, {tenant_address}
PROPERTY: {property_address}, Area: {area_sqft} sq ft
RENT: INR {monthly_rent}/month
DEPOSIT: INR {security_deposit}
TERM: {lease_term}, Start: {start_date}
BUSINESS: {business_type}
ESCALATION: {escalation}% annually
LOCK-IN: {lock_in} years
MAINTENANCE: INR {maintenance}/month

Include:
1. Parties and Premises
2. Term and possession
3. Rent, escalation, and deposit
4. Permitted use (strict business type)
5. Prohibition on subletting / assignment
6. Maintenance and repairs
7. Utilities and outgoings
8. Insurance
9. Default and termination
10. Lock-in and penalty
11. Renewal option
12. Dispute resolution
13. Signatures and witnesses

Formal commercial tone. Output plain text."""
    ),
]


# Fix: the consumer-complaint entry above used wrong class
# Override with correct data
TEMPLATES[6] = DocumentTemplate(
    slug="consumer-complaint",
    title="Consumer Complaint Letter",
    description="Formal complaint to company/shop for defective product, poor service, or refund. Ready to send or attach to District Forum complaint.",
    category="Consumer",
    icon="MessageCircleWarning",
    estimated_time="4 min",
    fields=[
        TemplateField(name="complainant_name", label="Your Full Name", placeholder="Anil Kumar"),
        TemplateField(name="complainant_address", label="Your Address", type="textarea", placeholder="45, Ameerpet, Hyderabad, TG - 500016"),
        TemplateField(name="company_name", label="Company / Seller Name", placeholder="ElectroMart Pvt. Ltd."),
        TemplateField(name="company_address", label="Company Address", type="textarea", placeholder="Forum Sujana Mall, Kukatpally, Hyderabad, TG - 500072"),
        TemplateField(name="product_service", label="Product / Service Details", placeholder="Samsung 55\" 4K Smart TV, Model UA55CU8000"),
        TemplateField(name="purchase_date", label="Purchase Date", type="date"),
        TemplateField(name="amount", label="Amount Paid (INR)", type="number", placeholder="42999"),
        TemplateField(name="invoice_no", label="Invoice / Receipt No.", placeholder="ELM-2026-05432"),
        TemplateField(name="issue", label="Nature of Complaint", type="textarea", placeholder="TV developed vertical lines on screen within 15 days of purchase. Company refusing replacement despite warranty."),
        TemplateField(name="remedy", label="Remedy Sought", type="select", options=["Refund", "Replacement", "Repair", "Compensation", "Apology + Service"], placeholder="Replacement"),
        TemplateField(name="demand_amount", label="Compensation Amount (if any)", type="number", placeholder="50000", required=False, help_text="Only if seeking compensation"),
        TemplateField(name="date", label="Date", type="date"),
        TemplateField(name="days_notice", label="Notice Period (days)", type="number", placeholder="15"),
    ],
    ai_prompt_template="""Draft a formal Consumer Complaint Letter under the Consumer Protection Act, 2019 for Telangana.

COMPLAINANT: {complainant_name}, {complainant_address}
AGAINST: {company_name}, {company_address}
PRODUCT: {product_service}
PURCHASED: {purchase_date}, Amount: INR {amount}
INVOICE: {invoice_no}
ISSUE: {issue}
REMEDY SOUGHT: {remedy}
COMPENSATION: INR {demand_amount}
DATE: {date}
NOTICE PERIOD: {days_notice} days

Include:
1. Sender and recipient addresses
2. Subject line
3. Reference to Consumer Protection Act, 2019
4. Chronology of events
5. Legal basis (deficiency in service, unfair trade practice)
6. Specific demands with deadline
7. Consequences (District Consumer Forum, State Commission)
8. Document reference list
9. Professional closing

Assertive but professional tone. Output plain text."""
)


class GenerateRequest(BaseModel):
    slug: str = Field(..., description="Template slug")
    fields: Dict[str, Any] = Field(..., description="Filled field values")


@router.get("/templates")
async def list_templates() -> Dict[str, Any]:
    return {
        "total": len(TEMPLATES),
        "templates": [{
            "slug": t.slug,
            "title": t.title,
            "description": t.description,
            "category": t.category,
            "icon": t.icon,
            "estimated_time": t.estimated_time,
            "field_count": len(t.fields),
        } for t in TEMPLATES]
    }


@router.get("/templates/{slug}")
async def get_template(slug: str) -> Dict[str, Any]:
    for t in TEMPLATES:
        if t.slug == slug:
            return {
                "slug": t.slug,
                "title": t.title,
                "description": t.description,
                "category": t.category,
                "icon": t.icon,
                "estimated_time": t.estimated_time,
                "fields": [f.model_dump() for f in t.fields],
                "ai_prompt_template": t.ai_prompt_template,
            }
    return {"error": "Template not found"}


@router.post("/generate")
async def generate_document(req: GenerateRequest, request: Request) -> Dict[str, Any]:
    template = None
    for t in TEMPLATES:
        if t.slug == req.slug:
            template = t
            break
    if not template:
        return {"error": "Template not found"}

    # Build the AI prompt by substituting fields
    prompt = template.ai_prompt_template
    for key, val in req.fields.items():
        placeholder = "{" + key + "}"
        prompt = prompt.replace(placeholder, str(val) if val is not None else "")

    # Cascade: Claude → GPT-5 → Gemini → template fallback
    document_text = None
    try:
        document_text = _call_claude(
            system="You are an expert Indian legal document drafter. Generate complete, legally sound documents in plain text. Use formal Indian legal English. No markdown formatting.",
            user=prompt,
            temperature=0.3,
            max_tokens=8000,
        )
    except Exception:
        pass
    if not document_text:
        try:
            document_text = _call_openai(
                system="You are an expert Indian legal document drafter. Generate complete, legally sound documents in plain text.",
                user=prompt,
                temperature=0.3,
                max_tokens=8000,
            )
        except Exception:
            pass
    if not document_text:
        try:
            document_text = _call_gemini(
                system="You are an expert Indian legal document drafter. Generate complete, legally sound documents in plain text.",
                user=prompt,
                temperature=0.3,
                max_tokens=8192,
            )
        except Exception:
            pass
    if not document_text:
        document_text = f"""LEGAL DOCUMENT: {template.title}

Generated from your inputs. Please review and customize with a lawyer.

---
{prompt}
---

[Note: AI providers were unavailable. This is a template outline. Please consult an advocate to finalize this document.]"""
    else:
        document_text = safe_ai_output(document_text)

    return {
        "slug": template.slug,
        "title": template.title,
        "document_text": document_text,
        "word_count": len(document_text.split()),
        "fields_used": list(req.fields.keys()),
    }
