"""Deterministic Indian legal-chat policy evaluation; run before prompt/model edits.

These cases verify profile retention and fail-closed prompt wiring, not the
quality of a live provider's generated legal opinion.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from legal_chat_policy import build_case_profile, is_lawyer_request, make_legal_chat_prompt, validate_citations

# Includes the transcript's Hyderabad landlord / arrears / missing lease / newer
# building scenario, followed by 31 representative Indian-law intake cases.
CASES = [
    ("I'm the landlord in Hyderabad, Telangana. The tenant owes ₹20,000/month for 8 months. No written agreement. The building is newer. Draft a Section 106 notice, then an eviction petition.", {"role":"landlord","city":"Hyderabad","state":"Telangana","matter_type":"residential_rent_eviction","monthly_amount_inr":20000,"unpaid_months":8,"written_agreement":"no","building_age":"newer"}),
    ("I am a tenant in Delhi facing eviction for rent arrears.", {"role":"tenant","city":"Delhi","state":"Delhi","matter_type":"residential_rent_eviction"}),
    ("Landlord in Mumbai has not returned my rental deposit.", {"city":"Mumbai","state":"Maharashtra","matter_type":"residential_rent_eviction"}),
    ("I am a landlord in Bengaluru and need a notice for unpaid rent.", {"role":"landlord","city":"Bengaluru","state":"Karnataka","matter_type":"residential_rent_eviction"}),
    ("The tenant in Hyderabad has overstayed after the lease ended.", {"city":"Hyderabad","state":"Telangana","matter_type":"residential_rent_eviction"}),
    ("I am a tenant in Mumbai; please draft a rent repair notice.", {"role":"tenant","city":"Mumbai","state":"Maharashtra","matter_type":"residential_rent_eviction"}),
    ("I was injured in a motor vehicle accident in Hyderabad.", {"city":"Hyderabad","state":"Telangana","matter_type":"motor_accident"}),
    ("A road crash in Delhi caused injury; what claim can I make?", {"city":"Delhi","state":"Delhi","matter_type":"motor_accident"}),
    ("My vehicle was hit in Bengaluru and the other driver fled.", {"city":"Bengaluru","state":"Karnataka","matter_type":"motor_accident"}),
    ("I need a motor accident compensation petition in Mumbai.", {"city":"Mumbai","state":"Maharashtra","matter_type":"motor_accident"}),
    ("My spouse seeks divorce in Hyderabad; explain the process.", {"city":"Hyderabad","state":"Telangana","matter_type":"family"}),
    ("I need to seek child custody in Delhi.", {"city":"Delhi","state":"Delhi","matter_type":"family"}),
    ("My spouse stopped paying maintenance in Mumbai.", {"city":"Mumbai","state":"Maharashtra","matter_type":"family"}),
    ("Draft a matrimonial petition concerning divorce in Bengaluru.", {"city":"Bengaluru","state":"Karnataka","matter_type":"family"}),
    ("A defective product seller refused my refund in Hyderabad.", {"city":"Hyderabad","state":"Telangana","matter_type":"consumer"}),
    ("I want to file a consumer complaint about a delayed refund in Delhi.", {"city":"Delhi","state":"Delhi","matter_type":"consumer"}),
    ("The online service was defective and the company denied a refund in Mumbai.", {"city":"Mumbai","state":"Maharashtra","matter_type":"consumer"}),
    ("Help with a consumer case over a faulty appliance in Bengaluru.", {"city":"Bengaluru","state":"Karnataka","matter_type":"consumer"}),
    ("My employer withheld salary in Hyderabad.", {"city":"Hyderabad","state":"Telangana","matter_type":"employment"}),
    ("I was terminated without notice in Delhi.", {"city":"Delhi","state":"Delhi","matter_type":"employment"}),
    ("My employer has not paid wages in Mumbai.", {"city":"Mumbai","state":"Maharashtra","matter_type":"employment"}),
    ("Workplace termination dispute in Bengaluru; draft a reply.", {"city":"Bengaluru","state":"Karnataka","matter_type":"employment"}),
    ("Police registered an FIR after an assault in Hyderabad.", {"city":"Hyderabad","state":"Telangana","matter_type":"criminal"}),
    ("I was arrested in Delhi; what should my family do?", {"city":"Delhi","state":"Delhi","matter_type":"criminal"}),
    ("Someone threatened me in Mumbai and I want to file a criminal complaint.", {"city":"Mumbai","state":"Maharashtra","matter_type":"criminal"}),
    ("Police allege criminal trespass in Bengaluru.", {"city":"Bengaluru","state":"Karnataka","matter_type":"criminal"}),
    ("A contractor breached our written contract in Hyderabad.", {"city":"Hyderabad","state":"Telangana","matter_type":"civil"}),
    ("My neighbour has encroached on property in Delhi.", {"city":"Delhi","state":"Delhi","matter_type":"civil"}),
    ("Draft a civil plaint for a property dispute in Mumbai.", {"city":"Mumbai","state":"Maharashtra","matter_type":"civil"}),
    ("I have a business contract dispute in Bengaluru.", {"city":"Bengaluru","state":"Karnataka","matter_type":"civil"}),
    ("A civil suit is needed for unpaid contract dues in Hyderabad.", {"city":"Hyderabad","state":"Telangana","matter_type":"civil"}),
    ("Please draft a property petition in Delhi.", {"city":"Delhi","state":"Delhi","matter_type":"civil"}),
]

@pytest.mark.parametrize("question,expected", CASES)
def test_indian_legal_chat_profile_eval(question, expected):
    profile = build_case_profile([], question)
    for key, value in expected.items():
        assert profile.get(key) == value, f"{key}: expected {value!r}; got {profile.get(key)!r}"

def test_profile_retains_facts_and_flags_contradiction_then_accepts_confirmation():
    history = [
        {"role":"user","content":"I am a landlord in Hyderabad. No written agreement."},
        {"role":"user","content":"There is a signed written agreement."},
    ]
    assert "written_agreement" in build_case_profile(history)["conflicts"]
    history += [
        {"role":"ai","content":"Which is correct about the written agreement?"},
        {"role":"user","content":"No"},
    ]
    resolved = build_case_profile(history)
    assert resolved["written_agreement"] == "no"
    assert not resolved["conflicts"]
    assert resolved["city"] == "Hyderabad"

def test_citation_policy_corrects_known_sections_and_flags_unknowns():
    out = validate_citations("Section 441 BNS and Section 999 CPC apply.")
    assert "Section 329 of the BNS" in out
    assert "unverified" in out
    assert "Section 106 TPA" in validate_citations("Section 106 TPA applies.")
    assert "Section 2(2) CPC" in validate_citations("Section 2(2) CPC defines decree.")

def test_prompt_has_required_drafting_and_venue_safeguards():
    prompt = make_legal_chat_prompt("Draft an eviction petition", "", {"state":"Telangana"}, [])
    for required in ("Section 106", "Order XXXVII", "check current limit", "[placeholders]", "Post this as a case"):
        assert required.lower() in prompt.lower()

def test_lawyer_handoff_intent_recognizes_direct_request():
    assert is_lawyer_request("I need a lawyer")
    assert is_lawyer_request("Can you connect me with an advocate?")
