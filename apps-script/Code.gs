/**
 * ASME Indy SponsorFlow — Google Apps Script backend
 * Version 2: name-based request access, member-suggested sponsors,
 * public participation statistics, and safer schema migrations.
 */

const SF = Object.freeze({
  VERSION: '2.0.0',
  SESSION_SECONDS: 3600,
  SHEETS: {
    CONTACTS: 'Contacts',
    TEMPLATES: 'Templates',
    REQUESTS: 'Requests',
    REVISIONS: 'Revisions',
    AUDIT: 'Audit'
  },
  HEADERS: {
    Contacts: ['id', 'companyName', 'contactName', 'email', 'category', 'notes', 'verified', 'active', 'createdAt', 'updatedAt'],
    Templates: ['id', 'name', 'category', 'description', 'subjectTemplate', 'bodyTemplate', 'active', 'createdAt', 'updatedAt'],
    Requests: ['id', 'accessHash', 'requesterName', 'requesterNameKey', 'requesterRole', 'contactId', 'companyName', 'contactName', 'contactEmail', 'sponsorVerification', 'templateId', 'templateName', 'subject', 'body', 'status', 'adminComment', 'revisionNumber', 'createdAt', 'updatedAt', 'submittedAt', 'sentAt'],
    Revisions: ['id', 'requestId', 'revisionNumber', 'actorType', 'actorName', 'subject', 'body', 'comment', 'status', 'createdAt'],
    Audit: ['id', 'requestId', 'action', 'actor', 'details', 'createdAt']
  }
});

const DEFAULT_TEMPLATES = [
  {
    id: 'TPL-GENERAL',
    name: 'Focused Sponsorship Request',
    category: 'Financial',
    description: 'A concise first-touch email with a specific ask, concrete student impact, and a clear next step.',
    subjectTemplate: 'Partnership idea: {{company_name}} × Purdue Indianapolis ASME',
    bodyTemplate: `Hello {{greeting_name}},

{{personalized_connection}}

My name is {{sender_name}}, and I am reaching out on behalf of the Purdue University Indianapolis chapter of the American Society of Mechanical Engineers. Our students design, build, test, and race an electric kart while developing practical experience in electrical systems, battery engineering, fabrication, and project management. The team recently finished fifth out of 27 competitors.

We are seeking {{specific_request}}. This support would help us {{specific_use}}.

In return, {{company_name}} would receive {{selected_benefits}}. We would also be glad to share photos and a concise update showing the student work your support made possible.

{{custom_message}}

Would you be open to a brief 15-minute conversation, or could you direct me to the person who handles sponsorships and community partnerships?

Thank you for considering Purdue Indianapolis student engineers.

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME
asmeindy@purdue.edu
https://asmevk.webflow.io`,
    active: true
  },
  {
    id: 'TPL-INKIND',
    name: 'Product, Equipment, or Materials Request',
    category: 'In-kind',
    description: 'Best for manufacturers and technical suppliers when the requested product has a clear engineering use.',
    subjectTemplate: '{{requested_item_short}} for Purdue Indianapolis student engineering',
    bodyTemplate: `Hello {{greeting_name}},

{{personalized_connection}}

I am {{sender_name}} with the Purdue University Indianapolis ASME EV-Kart Team. Our students design and manufacture an electric racing kart, including an in-house battery system and supporting electrical and mechanical components.

We are asking whether {{company_name}} would consider providing {{specific_request}}. It would allow our team to {{specific_use}} and give students hands-on experience with tools and materials used in professional engineering environments.

In recognition of the support, we can provide {{selected_benefits}}. We can also document the application with project photos, technical examples, and progress updates for your team.

{{custom_message}}

If a full donation is not possible, we would be grateful to discuss a discount, store credit, materials-only support, a refurbished or demonstration unit, or another option that fits your program.

Would you be open to a short conversation about what may be possible?

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME
asmeindy@purdue.edu
https://asmevk.webflow.io`,
    active: true
  },
  {
    id: 'TPL-LOCAL',
    name: 'Indianapolis Community Partnership',
    category: 'Local',
    description: 'Connects a local company with visible student work, campus presence, and the Indianapolis engineering community.',
    subjectTemplate: 'Indianapolis partnership opportunity with Purdue ASME',
    bodyTemplate: `Hello {{greeting_name}},

{{personalized_connection}}

My name is {{sender_name}}, and I represent the Purdue University Indianapolis chapter of ASME. Our chapter gives students practical experience through an electric-kart team and small engineering projects involving design, fabrication, electrical systems, testing, race operations, and project leadership.

We are currently seeking {{specific_request}} to help us {{specific_use}}.

A partnership would give {{company_name}} {{selected_benefits}} while connecting your organization with motivated engineering students on Purdue's Indianapolis campus.

{{custom_message}}

Would you have 15 minutes for an introduction in the next two weeks? We would be happy to share our project overview and find a partnership level that makes sense for your organization.

Thank you for investing in local student engineers.

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME
asmeindy@purdue.edu`,
    active: true
  },
  {
    id: 'TPL-RECRUITING',
    name: 'Engineering Talent Partnership',
    category: 'Recruiting',
    description: 'Frames sponsorship as both project support and a thoughtful connection to developing engineering talent.',
    subjectTemplate: 'Connect {{company_name}} with Purdue Indianapolis engineering students',
    bodyTemplate: `Hello {{greeting_name}},

{{personalized_connection}}

I am {{sender_name}} with Purdue University Indianapolis ASME. Our members gain practical experience by designing, fabricating, wiring, testing, and managing student engineering projects. Our largest current project is an electric racing kart with an in-house battery system.

We are seeking {{specific_request}} to support {{specific_use}}.

In return, we can provide {{selected_benefits}}. Where appropriate, we would also welcome a technical presentation, project review, facility conversation, or networking opportunity that helps students understand the work and careers available at {{company_name}}.

{{custom_message}}

Would you be interested in a brief conversation about a partnership that supports the project while building a meaningful connection with Purdue Indianapolis engineering students?

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME
asmeindy@purdue.edu`,
    active: true
  },
  {
    id: 'TPL-FOLLOWUP',
    name: 'Respectful Follow-Up',
    category: 'Follow-up',
    description: 'A short follow-up that restates the value and makes it easy to route the request to the right person.',
    subjectTemplate: 'Following up: Purdue Indianapolis ASME and {{company_name}}',
    bodyTemplate: `Hello {{greeting_name}},

I wanted to follow up on my earlier note about a possible partnership between {{company_name}} and Purdue University Indianapolis ASME.

We are seeking {{specific_request}} to help us {{specific_use}}. In return, we can provide {{selected_benefits}}.

{{personalized_connection}}

{{custom_message}}

Would you be the right person to discuss this, or could you point me toward the person who handles sponsorships, education programs, or community partnerships?

Thank you for your time.

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME
asmeindy@purdue.edu`,
    active: true
  },
  {
    id: 'TPL-THANKYOU',
    name: 'Sponsor Thank-You and Next Steps',
    category: 'Stewardship',
    description: 'Confirms the contribution, its student impact, sponsor benefits, and the assets needed for recognition.',
    subjectTemplate: 'Thank you for supporting Purdue Indianapolis ASME',
    bodyTemplate: `Hello {{greeting_name}},

On behalf of Purdue University Indianapolis ASME, thank you for supporting our students through {{specific_request}}.

Your support will help us {{specific_use}}. We have recorded the following partnership benefits: {{selected_benefits}}.

{{custom_message}}

To prepare your recognition materials, please send your preferred company name, a high-resolution or vector logo, any brand-use requirements, your preferred website link, and the best contact for project updates.

We are grateful to have {{company_name}} as a partner and look forward to showing you the progress your support makes possible.

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME
asmeindy@purdue.edu`,
    active: true
  }
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SponsorFlow')
    .addItem('Initial setup', 'showInitialSetup')
    .addItem('Upgrade to v2 + refresh templates', 'upgradeSponsorFlowV2')
    .addItem('Refresh polished templates', 'refreshPolishedTemplates')
    .addItem('Change admin password', 'showChangeAdminPassword')
    .addItem('Change GitHub Pages origin', 'showChangeFrontendOrigin')
    .addSeparator()
    .addItem('Open admin dashboard', 'openAdminDashboard')
    .addToUi();
}

function showInitialSetup() {
  const ui = SpreadsheetApp.getUi();
  const passwordPrompt = ui.prompt(
    'SponsorFlow initial setup',
    'Create one strong admin password (at least 14 characters). It will be hashed and will not be saved in the sheet.',
    ui.ButtonSet.OK_CANCEL
  );
  if (passwordPrompt.getSelectedButton() !== ui.Button.OK) return;

  const originPrompt = ui.prompt(
    'GitHub Pages origin',
    'Enter only the origin, such as https://yourusername.github.io (do not include the repository path).',
    ui.ButtonSet.OK_CANCEL
  );
  if (originPrompt.getSelectedButton() !== ui.Button.OK) return;

  setupSponsorFlow_();
  setAdminPassword_(passwordPrompt.getResponseText());
  setFrontendOrigin_(originPrompt.getResponseText());
  refreshDefaultTemplates_();
  ui.alert('SponsorFlow setup is complete. Next, deploy this script as a web app.');
}

function upgradeSponsorFlowV2() {
  setupSponsorFlow_();
  refreshDefaultTemplates_();
  SpreadsheetApp.getUi().alert('SponsorFlow was upgraded to version 2. Existing requests and contacts were preserved.');
}

function refreshPolishedTemplates() {
  setupSponsorFlow_();
  refreshDefaultTemplates_();
  SpreadsheetApp.getUi().alert('The six built-in templates were refreshed. Custom templates were not changed.');
}

function showChangeAdminPassword() {
  const ui = SpreadsheetApp.getUi();
  const prompt = ui.prompt('Change admin password', 'Enter a new password with at least 14 characters.', ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  setAdminPassword_(prompt.getResponseText());
  ui.alert('The admin password was changed. Existing admin sessions will expire within one hour.');
}

function showChangeFrontendOrigin() {
  const ui = SpreadsheetApp.getUi();
  const current = PropertiesService.getScriptProperties().getProperty('FRONTEND_ORIGIN') || '';
  const prompt = ui.prompt('Change GitHub Pages origin', `Current: ${current}\n\nEnter an origin such as https://yourusername.github.io`, ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  setFrontendOrigin_(prompt.getResponseText());
  ui.alert('The allowed frontend origin was updated.');
}

function openAdminDashboard() {
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert('Deploy the script as a web app first.');
    return;
  }
  const html = HtmlService.createHtmlOutput(`<script>window.open(${JSON.stringify(url + '?view=admin')}, '_blank');google.script.host.close();</script>`)
    .setWidth(10).setHeight(10);
  SpreadsheetApp.getUi().showModalDialog(html, 'Opening SponsorFlow');
}

function doGet(e) {
  if (e && e.parameter && e.parameter.view === 'admin') {
    return HtmlService.createHtmlOutputFromFile('Admin')
      .setTitle('ASME Indy SponsorFlow Admin')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return ContentService.createTextOutput('ASME Indy SponsorFlow data service is running.');
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  const origin = String(p.origin || '');
  const callId = String(p.callId || '');
  try {
    validateFrontendOrigin_(origin);
    ensureConfigured_();
    let data;
    switch (p.action) {
      case 'bootstrap': data = publicBootstrap_(); break;
      case 'createRequest': data = createRequest_(p); break;
      case 'getRequestsByName': data = getRequestsByName_(p); break;
      case 'getRequestByName': data = getRequestByName_(p); break;
      case 'reviseRequest': data = reviseRequest_(p); break;
      default: throw new Error('Unknown SponsorFlow action.');
    }
    return bridgeResponse_(origin, callId, { ok: true, data: data });
  } catch (error) {
    return bridgeResponse_(origin, callId, { ok: false, error: cleanError_(error) });
  }
}

function setupSponsorFlow_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  if (active) props.setProperty('SPREADSHEET_ID', active.getId());
  if (!props.getProperty('SPREADSHEET_ID')) throw new Error('SponsorFlow must be bound to a Google Sheet.');
  if (!props.getProperty('APP_SALT')) props.setProperty('APP_SALT', Utilities.getUuid() + Utilities.getUuid());
  ensureSchema_();
}

function ensureSchema_() {
  const spreadsheet = spreadsheet_();
  Object.keys(SF.HEADERS).forEach(name => ensureSheet_(spreadsheet, name, SF.HEADERS[name]));
  if (sheet_(SF.SHEETS.TEMPLATES).getLastRow() <= 1) refreshDefaultTemplates_();
  PropertiesService.getScriptProperties().setProperty('SCHEMA_VERSION', SF.VERSION);
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0].filter(Boolean);
    const missing = headers.filter(header => existing.indexOf(header) === -1);
    if (missing.length) sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
  const columnCount = sheet.getLastColumn();
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columnCount).setFontWeight('bold').setBackground('#cfb991');
  sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 2), columnCount).setNumberFormat('@');
}

function refreshDefaultTemplates_() {
  const now = nowIso_();
  DEFAULT_TEMPLATES.forEach(template => {
    const record = Object.assign({}, template, { active: String(template.active), updatedAt: now });
    const existing = findObjectById_(SF.SHEETS.TEMPLATES, template.id);
    if (existing) updateObjectById_(SF.SHEETS.TEMPLATES, template.id, record);
    else appendObject_(SF.SHEETS.TEMPLATES, Object.assign({}, record, { createdAt: now }));
  });
  PropertiesService.getScriptProperties().setProperty('DEFAULT_TEMPLATE_VERSION', SF.VERSION);
}

function setAdminPassword_(password) {
  password = String(password || '');
  if (password.length < 14) throw new Error('The admin password must contain at least 14 characters.');
  const props = PropertiesService.getScriptProperties();
  const salt = Utilities.getUuid() + Utilities.getUuid();
  props.setProperties({ ADMIN_PASSWORD_SALT: salt, ADMIN_PASSWORD_HASH: sha256_(salt + password) });
}

function setFrontendOrigin_(origin) {
  origin = String(origin || '').trim().replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)) {
    throw new Error('Enter an HTTPS origin only, such as https://yourusername.github.io');
  }
  PropertiesService.getScriptProperties().setProperty('FRONTEND_ORIGIN', origin);
}

function ensureConfigured_() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SPREADSHEET_ID') || !props.getProperty('ADMIN_PASSWORD_HASH') || !props.getProperty('FRONTEND_ORIGIN')) {
    throw new Error('SponsorFlow has not completed initial setup. Open the Google Sheet and use SponsorFlow → Initial setup.');
  }
  if (props.getProperty('SCHEMA_VERSION') !== SF.VERSION) ensureSchema_();
}

function validateFrontendOrigin_(origin) {
  const allowed = PropertiesService.getScriptProperties().getProperty('FRONTEND_ORIGIN');
  const isLocalPreview = /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
  if (!allowed || (origin !== allowed && !isLocalPreview)) throw new Error('This website is not allowed to use the SponsorFlow data service.');
}

function bridgeResponse_(origin, callId, payload) {
  const message = Object.assign({ type: 'sponsorflow-api', callId: callId }, payload);
  const safeMessage = JSON.stringify(message).replace(/</g, '\\u003c');
  const safeOrigin = JSON.stringify(origin).replace(/</g, '\\u003c');
  return HtmlService
    .createHtmlOutput(`<!doctype html><meta charset="utf-8"><script>window.top.postMessage(${safeMessage},${safeOrigin});</script>`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function publicBootstrap_() {
  const contacts = readObjects_(SF.SHEETS.CONTACTS)
    .filter(row => toBool_(row.verified) && toBool_(row.active))
    .map(row => ({ id: row.id, companyName: row.companyName, contactName: row.contactName, category: row.category }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
  const templates = readObjects_(SF.SHEETS.TEMPLATES)
    .filter(row => toBool_(row.active))
    .map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      subjectTemplate: row.subjectTemplate,
      bodyTemplate: row.bodyTemplate
    }));
  const requests = readObjects_(SF.SHEETS.REQUESTS);
  return {
    contacts: contacts,
    templates: templates,
    stats: buildPublicStats_(requests),
    memberNames: memberNames_(requests),
    version: SF.VERSION
  };
}

function createRequest_(p) {
  return withWriteLock_(function () {
    const requesterName = requireText_(p.requesterName, 'Your name', 2, 80);
    const requesterRole = optionalText_(p.requesterRole, 80);
    const template = findObjectById_(SF.SHEETS.TEMPLATES, requireText_(p.templateId, 'Template', 1, 80));
    if (!template || !toBool_(template.active)) throw new Error('The selected email template is no longer available.');

    const id = makeUniqueRequestId_();
    const sponsor = resolveSponsor_(p, id, requesterName);
    const subject = requireText_(p.subject, 'Subject', 10, 200);
    const body = requireText_(p.body, 'Email body', 100, 12000);
    if (/{{[^}]+}}/.test(subject + body)) throw new Error('Resolve every template placeholder before submitting.');

    const now = nowIso_();
    const record = {
      id: id,
      accessHash: '',
      requesterName: requesterName,
      requesterNameKey: normalizeNameKey_(requesterName),
      requesterRole: requesterRole,
      contactId: sponsor.contactId,
      companyName: sponsor.companyName,
      contactName: sponsor.contactName,
      contactEmail: sponsor.contactEmail,
      sponsorVerification: sponsor.verification,
      templateId: template.id,
      templateName: template.name,
      subject: subject,
      body: body,
      status: 'PENDING_REVIEW',
      adminComment: '',
      revisionNumber: '1',
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
      sentAt: ''
    };
    appendObject_(SF.SHEETS.REQUESTS, record);
    appendRevision_(record, 'MEMBER', requesterName, '', 'PENDING_REVIEW');
    appendAudit_(id, 'REQUEST_SUBMITTED', requesterName, `Revision 1 for ${sponsor.companyName} (${sponsor.verification})`);
    return { requestId: id, status: record.status, sponsorVerification: sponsor.verification };
  });
}

function resolveSponsor_(p, requestId, requesterName) {
  const mode = String(p.sponsorMode || 'directory').toLowerCase();
  if (mode !== 'custom') {
    const contact = findObjectById_(SF.SHEETS.CONTACTS, requireText_(p.contactId, 'Sponsor contact', 1, 80));
    if (!contact || !toBool_(contact.verified) || !toBool_(contact.active)) throw new Error('The selected sponsor contact is no longer available.');
    return {
      contactId: contact.id,
      companyName: contact.companyName,
      contactName: contact.contactName,
      contactEmail: contact.email,
      verification: 'VERIFIED'
    };
  }

  const companyName = requireText_(p.customCompanyName, 'Company name', 2, 160);
  const contactName = optionalText_(p.customContactName, 120);
  const contactEmail = requireEmail_(p.customContactEmail);
  const contacts = readObjects_(SF.SHEETS.CONTACTS);
  let existing = contacts.find(row => String(row.email || '').toLowerCase() === contactEmail);
  if (!existing) {
    const now = nowIso_();
    existing = {
      id: 'CON-' + randomCode_(10),
      companyName: companyName,
      contactName: contactName,
      email: contactEmail,
      category: 'Member suggestion',
      notes: `Suggested by ${requesterName} in ${requestId}. Verify before approval.`,
      verified: 'false',
      active: 'false',
      createdAt: now,
      updatedAt: now
    };
    appendObject_(SF.SHEETS.CONTACTS, existing);
    appendAudit_(requestId, 'UNVERIFIED_CONTACT_SUGGESTED', requesterName, `${companyName} <${contactEmail}>`);
  }
  const verified = toBool_(existing.verified) && toBool_(existing.active);
  return {
    contactId: existing.id,
    companyName: verified ? existing.companyName : companyName,
    contactName: verified ? existing.contactName : contactName,
    contactEmail: contactEmail,
    verification: verified ? 'VERIFIED' : 'UNVERIFIED'
  };
}

function getRequestsByName_(p) {
  const requesterName = requireText_(p.requesterName, 'Your name', 2, 80);
  const key = normalizeNameKey_(requesterName);
  return readObjects_(SF.SHEETS.REQUESTS)
    .filter(record => normalizeNameKey_(record.requesterNameKey || record.requesterName) === key)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 200)
    .map(publicRequest_);
}

function getRequestByName_(p) {
  const id = requirePattern_(String(p.requestId || '').toUpperCase(), /^REQ-[A-Z2-9]{8}$/, 'Invalid request ID.');
  const requesterName = requireText_(p.requesterName, 'Your name', 2, 80);
  const record = findObjectById_(SF.SHEETS.REQUESTS, id);
  if (!record || normalizeNameKey_(record.requesterNameKey || record.requesterName) !== normalizeNameKey_(requesterName)) {
    throw new Error('No request with that ID was found under this name.');
  }
  return publicRequest_(record);
}

function reviseRequest_(p) {
  return withWriteLock_(function () {
    const id = requirePattern_(String(p.requestId || '').toUpperCase(), /^REQ-[A-Z2-9]{8}$/, 'Invalid request ID.');
    const requesterName = requireText_(p.requesterName, 'Your name', 2, 80);
    const record = findObjectById_(SF.SHEETS.REQUESTS, id);
    if (!record || normalizeNameKey_(record.requesterNameKey || record.requesterName) !== normalizeNameKey_(requesterName)) {
      throw new Error('This request is not filed under that name.');
    }
    if (record.status !== 'CHANGES_REQUESTED') throw new Error('This request is not currently open for revision.');
    const subject = requireText_(p.subject, 'Subject', 10, 200);
    const body = requireText_(p.body, 'Email body', 100, 12000);
    if (/{{[^}]+}}/.test(subject + body)) throw new Error('Resolve every template placeholder before submitting.');
    const revisionNumber = Number(record.revisionNumber || 1) + 1;
    const now = nowIso_();
    updateObjectById_(SF.SHEETS.REQUESTS, id, {
      requesterName: requesterName,
      requesterNameKey: normalizeNameKey_(requesterName),
      requesterRole: optionalText_(p.requesterRole, 80),
      subject: subject,
      body: body,
      status: 'PENDING_REVIEW',
      revisionNumber: String(revisionNumber),
      updatedAt: now,
      submittedAt: now
    });
    const updated = findObjectById_(SF.SHEETS.REQUESTS, id);
    appendRevision_(updated, 'MEMBER', requesterName, '', 'PENDING_REVIEW');
    appendAudit_(id, 'REVISION_SUBMITTED', requesterName, `Revision ${revisionNumber}`);
    return { requestId: id, status: 'PENDING_REVIEW', revisionNumber: revisionNumber };
  });
}

function publicRequest_(record) {
  return {
    id: record.id,
    requesterName: record.requesterName,
    requesterRole: record.requesterRole,
    contactId: record.contactId,
    companyName: record.companyName,
    contactName: record.contactName,
    sponsorVerification: sponsorVerification_(record),
    templateId: record.templateId,
    templateName: record.templateName,
    subject: record.subject,
    body: record.body,
    status: record.status,
    adminComment: record.adminComment,
    revisionNumber: Number(record.revisionNumber || 1),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    sentAt: record.sentAt
  };
}

function buildPublicStats_(requests) {
  const sent = requests.filter(row => row.status === 'SENT');
  const pending = requests.filter(row => ['PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'].indexOf(row.status) !== -1);
  return {
    totalRequests: requests.length,
    totalSent: sent.length,
    totalPending: pending.length,
    participatingMembers: memberNames_(requests).length,
    leadersSent: leaderboard_(sent),
    leadersPending: leaderboard_(pending),
    timeline: sentTimeline_(sent)
  };
}

function memberNames_(requests) {
  const names = new Map();
  requests.forEach(row => {
    const key = normalizeNameKey_(row.requesterNameKey || row.requesterName);
    if (!key) return;
    const current = names.get(key);
    if (!current || String(row.updatedAt) > String(current.updatedAt)) names.set(key, { name: row.requesterName, updatedAt: row.updatedAt });
  });
  return Array.from(names.values()).map(item => item.name).sort((a, b) => a.localeCompare(b));
}

function leaderboard_(rows) {
  const counts = new Map();
  rows.forEach(row => {
    const key = normalizeNameKey_(row.requesterNameKey || row.requesterName);
    if (!key) return;
    const current = counts.get(key) || { name: row.requesterName, count: 0, updatedAt: '' };
    current.count += 1;
    if (String(row.updatedAt) >= String(current.updatedAt)) {
      current.name = row.requesterName;
      current.updatedAt = row.updatedAt;
    }
    counts.set(key, current);
  });
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8)
    .map(item => ({ name: item.name, count: item.count }));
}

function sentTimeline_(rows) {
  const months = new Map();
  rows.forEach(row => {
    const date = new Date(row.sentAt || row.updatedAt || row.createdAt);
    if (isNaN(date.getTime())) return;
    const key = Utilities.formatDate(date, 'UTC', 'yyyy-MM');
    months.set(key, (months.get(key) || 0) + 1);
  });
  const recorded = Array.from(months.keys()).sort();
  if (!recorded.length) return [];
  const startParts = recorded[0].split('-').map(Number);
  const endParts = recorded[recorded.length - 1].split('-').map(Number);
  const cursor = new Date(Date.UTC(startParts[0], startParts[1] - 1, 1));
  const end = new Date(Date.UTC(endParts[0], endParts[1] - 1, 1));
  const points = [];
  let cumulative = 0;
  while (cursor <= end) {
    const key = Utilities.formatDate(cursor, 'UTC', 'yyyy-MM');
    const count = months.get(key) || 0;
    cumulative += count;
    points.push({ month: key, count: count, cumulative: cumulative });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return points;
}

function sponsorVerification_(record) {
  const explicit = String(record.sponsorVerification || '').toUpperCase();
  if (explicit === 'VERIFIED' || explicit === 'UNVERIFIED') return explicit;
  return record.contactId ? 'VERIFIED' : 'UNVERIFIED';
}

// -------------------------- Admin dashboard server API --------------------------

function adminLogin(password) {
  ensureConfigured_();
  const cache = CacheService.getScriptCache();
  const failures = Number(cache.get('ADMIN_LOGIN_FAILURES') || 0);
  if (failures >= 12) throw new Error('Too many failed login attempts. Wait ten minutes and try again.');
  const props = PropertiesService.getScriptProperties();
  const expected = props.getProperty('ADMIN_PASSWORD_HASH');
  const actual = sha256_(props.getProperty('ADMIN_PASSWORD_SALT') + String(password || ''));
  if (!constantTimeEqual_(expected, actual)) {
    cache.put('ADMIN_LOGIN_FAILURES', String(failures + 1), 600);
    throw new Error('Incorrect admin password.');
  }
  cache.remove('ADMIN_LOGIN_FAILURES');
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  cache.put('ADMIN_SESSION_' + sha256_(token), nowIso_(), SF.SESSION_SECONDS);
  return { token: token, expiresInSeconds: SF.SESSION_SECONDS };
}

function adminLogout(token) {
  if (token) CacheService.getScriptCache().remove('ADMIN_SESSION_' + sha256_(String(token)));
  return true;
}

function getAdminData(token) {
  requireAdminToken_(token);
  const requests = readObjects_(SF.SHEETS.REQUESTS)
    .map(row => Object.assign({}, row, { sponsorVerification: sponsorVerification_(row), revisionNumber: Number(row.revisionNumber || 1) }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const contacts = readObjects_(SF.SHEETS.CONTACTS).sort((a, b) => a.companyName.localeCompare(b.companyName));
  const templates = readObjects_(SF.SHEETS.TEMPLATES);
  return { requests: requests, contacts: contacts, templates: templates, clubEmail: 'asmeindy@purdue.edu' };
}

function adminUpdateRequest(token, requestId, nextStatus, comment) {
  requireAdminToken_(token);
  return withWriteLock_(function () {
    const id = requireText_(requestId, 'Request ID', 1, 80);
    const status = String(nextStatus || '').toUpperCase();
    const allowed = ['CHANGES_REQUESTED', 'APPROVED', 'SENT', 'REJECTED'];
    if (allowed.indexOf(status) === -1) throw new Error('Invalid request status.');
    const record = findObjectById_(SF.SHEETS.REQUESTS, id);
    if (!record) throw new Error('Request not found.');
    if (record.status === 'SENT') throw new Error('A sent request cannot be changed.');
    if ((status === 'APPROVED' || status === 'SENT') && sponsorVerification_(record) !== 'VERIFIED') {
      throw new Error('Verify the sponsor email before approving or marking this request sent.');
    }
    if (status === 'SENT' && record.status !== 'APPROVED') {
      throw new Error('Approve the request before marking it sent.');
    }
    const cleanComment = optionalText_(comment, 2000);
    if ((status === 'CHANGES_REQUESTED' || status === 'REJECTED') && cleanComment.length < 4) {
      throw new Error('Add a helpful comment before sending the request back or rejecting it.');
    }
    const updates = { status: status, adminComment: cleanComment, updatedAt: nowIso_() };
    if (status === 'SENT') updates.sentAt = nowIso_();
    updateObjectById_(SF.SHEETS.REQUESTS, id, updates);
    const updated = findObjectById_(SF.SHEETS.REQUESTS, id);
    appendRevision_(updated, 'ADMIN', 'SponsorFlow Admin', cleanComment, status);
    appendAudit_(id, 'STATUS_' + status, 'SponsorFlow Admin', cleanComment);
    return publicRequest_(updated);
  });
}

function adminVerifySponsor(token, requestId) {
  requireAdminToken_(token);
  return withWriteLock_(function () {
    const id = requireText_(requestId, 'Request ID', 1, 80);
    const request = findObjectById_(SF.SHEETS.REQUESTS, id);
    if (!request) throw new Error('Request not found.');
    const email = requireEmail_(request.contactEmail);
    const contacts = readObjects_(SF.SHEETS.CONTACTS);
    let contact = contacts.find(row => String(row.email || '').toLowerCase() === email);
    const now = nowIso_();
    if (contact) {
      updateObjectById_(SF.SHEETS.CONTACTS, contact.id, {
        companyName: request.companyName,
        contactName: request.contactName,
        email: email,
        verified: 'true',
        active: 'true',
        updatedAt: now
      });
    } else {
      contact = {
        id: 'CON-' + randomCode_(10),
        companyName: request.companyName,
        contactName: request.contactName,
        email: email,
        category: 'Member suggestion',
        notes: `Verified from request ${id}.`,
        verified: 'true',
        active: 'true',
        createdAt: now,
        updatedAt: now
      };
      appendObject_(SF.SHEETS.CONTACTS, contact);
    }
    markRequestsVerifiedByEmail_(email, contact.id);
    appendAudit_(id, 'SPONSOR_VERIFIED', 'SponsorFlow Admin', `${request.companyName} <${email}>`);
    return true;
  });
}

function adminSaveContact(token, data) {
  requireAdminToken_(token);
  return withWriteLock_(function () {
    data = data || {};
    const existingId = optionalText_(data.id, 80);
    const id = existingId || ('CON-' + randomCode_(10));
    const now = nowIso_();
    const record = {
      id: id,
      companyName: requireText_(data.companyName, 'Company name', 2, 160),
      contactName: optionalText_(data.contactName, 120),
      email: requireEmail_(data.email),
      category: optionalText_(data.category, 80),
      notes: optionalText_(data.notes, 2000),
      verified: String(toBool_(data.verified)),
      active: String(data.active === false || String(data.active).toLowerCase() === 'false' ? false : true),
      updatedAt: now
    };
    if (existingId) {
      if (!findObjectById_(SF.SHEETS.CONTACTS, existingId)) throw new Error('Contact not found.');
      updateObjectById_(SF.SHEETS.CONTACTS, existingId, record);
    } else {
      record.createdAt = now;
      appendObject_(SF.SHEETS.CONTACTS, record);
    }
    if (toBool_(record.verified)) markRequestsVerifiedByEmail_(record.email, id);
    appendAudit_('', existingId ? 'CONTACT_UPDATED' : 'CONTACT_CREATED', 'SponsorFlow Admin', record.companyName);
    return findObjectById_(SF.SHEETS.CONTACTS, id);
  });
}

function adminSaveTemplate(token, data) {
  requireAdminToken_(token);
  return withWriteLock_(function () {
    data = data || {};
    const existingId = optionalText_(data.id, 80);
    const id = existingId || ('TPL-' + randomCode_(10));
    const now = nowIso_();
    const record = {
      id: id,
      name: requireText_(data.name, 'Template name', 2, 160),
      category: requireText_(data.category, 'Template category', 2, 80),
      description: optionalText_(data.description, 600),
      subjectTemplate: requireText_(data.subjectTemplate, 'Subject template', 5, 300),
      bodyTemplate: requireText_(data.bodyTemplate, 'Body template', 100, 15000),
      active: String(data.active === false || String(data.active).toLowerCase() === 'false' ? false : true),
      updatedAt: now
    };
    if (existingId) {
      if (!findObjectById_(SF.SHEETS.TEMPLATES, existingId)) throw new Error('Template not found.');
      updateObjectById_(SF.SHEETS.TEMPLATES, existingId, record);
    } else {
      record.createdAt = now;
      appendObject_(SF.SHEETS.TEMPLATES, record);
    }
    appendAudit_('', existingId ? 'TEMPLATE_UPDATED' : 'TEMPLATE_CREATED', 'SponsorFlow Admin', record.name);
    return findObjectById_(SF.SHEETS.TEMPLATES, id);
  });
}

function requireAdminToken_(token) {
  token = String(token || '');
  if (token.length < 40) throw new Error('Your admin session has expired. Sign in again.');
  const cache = CacheService.getScriptCache();
  const key = 'ADMIN_SESSION_' + sha256_(token);
  if (!cache.get(key)) throw new Error('Your admin session has expired. Sign in again.');
  cache.put(key, nowIso_(), SF.SESSION_SECONDS);
}

function markRequestsVerifiedByEmail_(email, contactId) {
  const sheet = sheet_(SF.SHEETS.REQUESTS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  const headers = values[0].map(String);
  const emailIndex = headers.indexOf('contactEmail');
  const verificationIndex = headers.indexOf('sponsorVerification');
  const contactIdIndex = headers.indexOf('contactId');
  if (emailIndex < 0 || verificationIndex < 0) return;
  let changed = false;
  for (let row = 1; row < values.length; row += 1) {
    if (String(decodeCell_(values[row][emailIndex])).toLowerCase() !== String(email).toLowerCase()) continue;
    values[row][verificationIndex] = 'VERIFIED';
    if (contactIdIndex >= 0) values[row][contactIdIndex] = contactId;
    changed = true;
  }
  if (changed) sheet.getRange(1, 1, values.length, headers.length).setValues(values);
}

// -------------------------- Storage helpers --------------------------

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SponsorFlow spreadsheet is not configured.');
  return SpreadsheetApp.openById(id);
}

function sheet_(name) {
  const sheet = spreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error(`Missing sheet: ${name}`);
  return sheet;
}

function readObjects_(name) {
  const sheet = sheet_(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(value => value !== '')).map(row => {
    const object = {};
    headers.forEach((header, index) => object[header] = decodeCell_(row[index]));
    return object;
  });
}

function appendObject_(name, object) {
  const sheet = sheet_(name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(String);
  const values = headers.map(header => encodeCell_(object[header] == null ? '' : object[header]));
  sheet.appendRow(values);
}

function findObjectById_(name, id) {
  return readObjects_(name).find(row => row.id === id) || null;
}

function updateObjectById_(name, id, updates) {
  const sheet = sheet_(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('Record not found.');
  const headers = values[0].map(String);
  const idIndex = headers.indexOf('id');
  const rowIndex = values.findIndex((row, index) => index > 0 && decodeCell_(row[idIndex]) === id);
  if (rowIndex < 1) throw new Error('Record not found.');
  Object.keys(updates).forEach(key => {
    const columnIndex = headers.indexOf(key);
    if (columnIndex >= 0) values[rowIndex][columnIndex] = encodeCell_(updates[key]);
  });
  sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([values[rowIndex]]);
}

function appendRevision_(request, actorType, actorName, comment, status) {
  appendObject_(SF.SHEETS.REVISIONS, {
    id: 'REV-' + randomCode_(12),
    requestId: request.id,
    revisionNumber: request.revisionNumber,
    actorType: actorType,
    actorName: actorName,
    subject: request.subject,
    body: request.body,
    comment: comment,
    status: status,
    createdAt: nowIso_()
  });
}

function appendAudit_(requestId, action, actor, details) {
  appendObject_(SF.SHEETS.AUDIT, {
    id: 'AUD-' + randomCode_(12),
    requestId: requestId,
    action: action,
    actor: actor,
    details: details,
    createdAt: nowIso_()
  });
}

function withWriteLock_(callback) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('SponsorFlow is busy. Try again in a moment.');
  try { return callback(); } finally { lock.releaseLock(); }
}

// -------------------------- Validation and utility helpers --------------------------

function sha256_(value) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return digest.map(byte => (byte + 256).toString(16).slice(-2)).join('');
}

function constantTimeEqual_(left, right) {
  left = String(left || '');
  right = String(right || '');
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function requireText_(value, label, minLength, maxLength) {
  const clean = String(value || '').trim().replace(/\r\n/g, '\n');
  if (clean.length < minLength) throw new Error(`${label} is required.`);
  if (clean.length > maxLength) throw new Error(`${label} is too long.`);
  return clean;
}

function optionalText_(value, maxLength) {
  const clean = String(value || '').trim().replace(/\r\n/g, '\n');
  if (clean.length > maxLength) throw new Error('One of the submitted fields is too long.');
  return clean;
}

function requirePattern_(value, pattern, message) {
  const clean = String(value || '').trim();
  if (!pattern.test(clean)) throw new Error(message);
  return clean;
}

function requireEmail_(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid sponsor email address.');
  return email;
}

function normalizeNameKey_(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function makeUniqueRequestId_() {
  let id = '';
  do { id = 'REQ-' + randomCode_(8); } while (findObjectById_(SF.SHEETS.REQUESTS, id));
  return id;
}

function randomCode_(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let output = '';
  while (output.length < length) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random());
    bytes.forEach(byte => {
      if (output.length < length) output += alphabet[(byte + 256) % alphabet.length];
    });
  }
  return output;
}

function nowIso_() {
  return new Date().toISOString();
}

function toBool_(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function encodeCell_(value) {
  if (value instanceof Date) value = value.toISOString();
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function decodeCell_(value) {
  if (value instanceof Date) return value.toISOString();
  const text = String(value == null ? '' : value);
  return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
}

function cleanError_(error) {
  return error && error.message ? String(error.message) : 'The request could not be completed.';
}
