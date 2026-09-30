// GoHighLevel's contact webhook JSON, copied from the landingpage project
// (lib/leadWebhookTemplate.ts) so leads from this site have the same shape
// downstream. Most keys belong to a multi-purpose CRM form template; every
// one this site has data for is filled, the rest stay blank.
// Files starting with "_" in api/ are not deployed as routes.

export function blankTemplate() {
  return {
    "MAQO": "",
    "Preferred Appointment Date:": "",
    "Marital Status:": "",
    "What makes you a suitable candidate for this position?": "",
    "Identification Card (IC) Upload ": "",
    " Description of the Issue:": "",
    "Do you have any specific health coverage needs or preferences?": "",
    "Electric Bill (RM)": "",
    "Billing Address - City": "",
    "Which services are you requesting?": "",
    "Date of Service:": "",
    "Billing Address - State": "",
    "Billing Address - Zip Code": "",
    "Upload Resume": "",
    "Type of Business": "",
    "Business Name": "",
    "Site Location": "",
    "Job Scope": "",
    "Preferred Communication Language 2": "",
    "Vehicle Make:": "",
    "Billing Address - Full Address": "",
    "Billing Address - Phone Number": "",
    "Preferred Contact Method:": "",
    "Monthly Electric Bill (RM)": "",
    "Attach any relevant photos or documents related to the service request (if applicable).": "",
    "What additional solar services are you interested in?": "",
    "consultant": "",
    "Why do you want to work with our company?": "",
    "Gender:": "",
    "Do you currently have a solar system installed?": "",
    "Any Additional Comments, Questions Or Special Requests?": "",
    "How did you hear about us?": "",
    "Position Applied": "",
    " Type of Service Needed (Check all that apply):": "",
    "follower": "",
    "Preferred Date:": "",
    "Type of Coverage Needed:": "",
    "Occupation": "",
    "Identification Card (IC)": "",
    "Years in Operation": "",
    "Property Type (Condo/Apartment not suitable)": "",
    "What is your role in this  organization?": "",
    "What solution are you interested in?": "",
    "Brief description of your situation": "",
    "Location/Address": "",
    "Preferred Communication Language 1": "",
    "salespartner": "",
    "Details": "",
    "Tell Us Your Skincare Needs": "",
    "If yes, please specify:": "",
    "Interested": "",
    " Type of Service Request:": "",
    "Existing Customer": "",
    "File Upload 498q": "",
    "Phone Number": "",
    "Position Applied For": "",
    "What best describes your current stage in the solar energy journey? ": "",
    "Do you have any pre-existing health conditions?": "",
    "Message": "",
    "Multi Dropdown 1tw9": "",
    "Remarks": "",
    "Preferred Appointment Time:": "",
    "Monthly Electric Bills (RM)": "",
    "Campaign ID": "",
    "Location": "",
    "What type of real estate service are you interested in?": "",
    "Position": "",
    "Billing Address - Country": "",
    "sprecruit": "",
    "Signature 19ei": "",
    "Salutation": "",
    "Nationality": "",
    "bizpartner": "",
    "If yes, please provide details:  System size, Installation date, & Manufacturer": "",
    "Billing Address - Full Name": "",
    "How can we help?": "",
    "Primary Care Physician:": "",
    "Description of Request:": "",
    "Vehicle Model:": "",
    "Graduation Date": "",
    "Vehicle Year:": "",
    "Preferred Communication Language": "",
    "Industry": "",
    "Additional Notes": "",
    "Current Job Status": "",
    "Electric Supply": "",
    "Name of Company": "",
    "referrer": "",
    "Attachment": "",
    "Type of Service Needed - Check all that apply": "",
    "staff": "",
    "Electric Bills (RM)": "",
    "referer": "",
    "Preferred time slots": "",
    "Product Category": "",
    "contact_id": "",
    "first_name": "",
    "last_name": "",
    "full_name": "",
    "email": "",
    "phone": "",
    "tags": "",
    "country": "",
    "timezone": "",
    "date_created": "",
    "contact_source": "",
    "full_address": "",
    "contact_type": "",
    "gclid": "",
    "location": {},
    "workflow": {},
    "triggerData": {},
    "contact": {},
    "attributionSource": {},
    "customData": {
      "Name": "",
      "Salutation": "",
      "Phone": "",
      "Email": "",
      "Location": "",
      "Property Type": "",
      "Electric Supply": "",
      "Monthly TNB Bill": "",
      "Source of Leads": "",
      "Campaign ID": "",
      "Landing Page Source": "",
      "Fbclid": "",
      "UTM Source": "",
      "UTM Medium": "",
      "UTM Campaign": "",
      "UTM Term": "",
      "UTM Content": "",
    },
  };
}

// GoHighLevel sub-account the forms belong to (the locationId on every field).
const GHL_LOCATION_ID = "RxbwqsL86moAQoTiBTtV";

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
}

// Every key any lead type has data for. The per-type builders below add
// their own form fields on top.
function fillCommon(payload, input) {
  const { first, last } = splitName(input.fullName);
  const now = new Date().toISOString();

  payload["full_name"] = input.fullName;
  payload["first_name"] = first;
  payload["last_name"] = last;
  payload["email"] = input.email;
  payload["phone"] = input.phone;
  payload["Phone Number"] = input.phone;
  payload["country"] = input.country;
  payload["timezone"] = input.timezone;
  payload["date_created"] = now;
  payload["contact_source"] = input.sourcePage;
  payload["contact_type"] = "lead";
  payload["gclid"] = input.gclid;
  payload["Campaign ID"] = input.campaignId;
  payload["MAQO"] = input.maqo;
  payload["salespartner"] = input.salespartner;
  payload["referer"] = input.referer;
  payload["referrer"] = input.referer || input.sourceOfLeads;
  if (input.remarks) payload["Remarks"] = input.remarks;

  payload["location"] = { id: GHL_LOCATION_ID };
  payload["attributionSource"] = {
    url: input.landingPageSource,
    referrer: input.sourceOfLeads,
    campaign: input.utmCampaign,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    utmTerm: input.utmTerm,
    utmContent: input.utmContent,
    gclid: input.gclid,
    fbclid: input.fbclid,
  };

  const customData = payload.customData;
  customData["Name"] = input.fullName;
  customData["Phone"] = input.phone;
  customData["Email"] = input.email;
  customData["Source of Leads"] = input.sourceOfLeads;
  customData["Campaign ID"] = input.campaignId;
  customData["Landing Page Source"] = input.landingPageSource;
  customData["Fbclid"] = input.fbclid;
  customData["UTM Source"] = input.utmSource;
  customData["UTM Medium"] = input.utmMedium;
  customData["UTM Campaign"] = input.utmCampaign;
  customData["UTM Term"] = input.utmTerm;
  customData["UTM Content"] = input.utmContent;
  return payload;
}

/** Residential (and blog) leads. Keeps every key landingpage's
 * buildLeadWebhookPayload sets, and fills the rest we have data for. */
export function buildLeadWebhookPayload(input) {
  const payload = fillCommon(blankTemplate(), input);

  payload["Salutation"] = input.salutation;
  payload["Location"] = input.state;
  payload["Property Type (Condo/Apartment not suitable)"] = input.propertyType;
  payload["Electric Supply"] = input.electricSupply;
  payload["Monthly Electric Bills (RM)"] = input.monthlyBillRange;
  payload["Preferred Communication Language"] = input.preferredLanguage;
  payload["Preferred Communication Language 2"] = input.preferredLanguage;

  const customData = payload.customData;
  customData["Salutation"] = input.salutation;
  customData["Location"] = input.state;
  customData["Property Type"] = input.propertyType;
  customData["Electric Supply"] = input.electricSupply;
  customData["Monthly TNB Bill"] = input.monthlyBillRange;

  return payload;
}

/** C&I leads. Keeps every key landingpage's buildCiLeadWebhookPayload sets
 * (multi-choice fields as arrays, like GoHighLevel sends them) and fills the
 * rest we have data for. */
export function buildCiLeadWebhookPayload(input) {
  const payload = fillCommon(blankTemplate(), input);
  const bill = input.monthlyBillRange.join(", ");

  payload["Salutation"] = input.salutation;
  payload["Location"] = input.state;
  payload["Name of Company"] = input.companyName;
  payload["Business Name"] = input.companyName;
  payload["Industry"] = input.industry;
  payload["Type of Business"] = input.industry.join(", ");
  payload["Electric Bill (RM)"] = input.monthlyBillRange;
  // The BESS form's own field; blank for the other C&I forms.
  payload["Monthly Electric Bill (RM)"] = input.isBess ? input.monthlyBillRange : "";
  payload["What is your role in this  organization?"] = input.roleInOrganization;
  payload["Position"] = input.roleInOrganization.join(", ");

  const customData = payload.customData;
  customData["Name"] = `${input.salutation} ${input.fullName}`.trim();
  customData["Salutation"] = input.salutation;
  customData["Location"] = input.state;
  customData["Monthly TNB Bill"] = bill;
  customData["Company Name"] = input.companyName;
  customData["Industry"] = input.industry.join(", ");
  customData["Role In Organization"] = input.roleInOrganization.join(", ");
  customData["Monthly Electric Bill"] = bill;

  return payload;
}

/** Career applications. landingpage has no career form, so this fills the
 * template's own career keys ("Position Applied", "Message", "Upload Resume"). */
export function buildCareerWebhookPayload(input) {
  const payload = fillCommon(blankTemplate(), input);

  payload["Position Applied"] = input.position;
  payload["Position Applied For"] = input.position;
  payload["Message"] = input.message;
  payload["Upload Resume"] = input.files;
  payload["Attachment"] = input.files;

  return payload;
}
