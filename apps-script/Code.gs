/**
 * ASME Indy SponsorFlow — Google Apps Script backend
 *
 * Bind this script to a Google Sheet. It stores requests, contacts,
 * templates, revision history, and audit records in that spreadsheet.
 */

const SF = Object.freeze({
  VERSION: '1.0.0',
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
    Requests: ['id', 'accessHash', 'requesterName', 'requesterNameKey', 'requesterRole', 'contactId', 'companyName', 'contactName', 'contactEmail', 'templateId', 'templateName', 'subject', 'body', 'status', 'adminComment', 'revisionNumber', 'createdAt', 'updatedAt', 'submittedAt', 'sentAt'],
    Revisions: ['id', 'requestId', 'revisionNumber', 'actorType', 'actorName', 'subject', 'body', 'comment', 'status', 'createdAt'],
    Audit: ['id', 'requestId', 'action', 'actor', 'details', 'createdAt']
  }
});

const DEFAULT_TEMPLATES = [
  {
    id: 'TPL-GENERAL',
    name: 'General Financial Partnership',
    category: 'Financial',
    description: 'A concise, personalized first-touch request for a defined sponsorship amount.',
    subjectTemplate: '{{company_name}} + Purdue Indianapolis ASME | 2026 Partnership',
    bodyTemplate: `Hello {{contact_first_name}},

{{personalized_connection}}

My name is {{sender_name}}, and I am reaching out on behalf of the Purdue University Indianapolis chapter of the American Society of Mechanical Engineers.

Our student-led team develops hands-on engineering experience through our EV-Kart and small-projects programs. We recently finished fifth out of 27 teams, and our next development cycle focuses on improving the kart's electrical architecture, battery system, reliability, and endurance.

We are seeking {{specific_request}} from {{company_name}}. This support would directly help us {{specific_use}}.

In recognition of your support, we would provide {{selected_benefits}}.

{{custom_message}}

Would you be available for a brief 15-minute conversation to discuss the project and determine which partnership option would be the best fit? Our project overview is available at https://asmevk.webflow.io.

Thank you for considering an investment in student engineering at Purdue University Indianapolis.

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME
asmeindy@purdue.edu`,
    active: true
  },
  {
    id: 'TPL-INKIND',
    name: 'Equipment or In-Kind Sponsorship',
    category: 'In-kind',
    description: 'For manufacturers, suppliers, software companies, machine shops, and technical vendors.',
    subjectTemplate: 'Equipment Partnership Request | Purdue Indianapolis ASME + {{company_name}}',
    bodyTemplate: `Hello {{contact_first_name}},

My name is {{sender_name}}, and I am reaching out on behalf of the Purdue University Indianapolis ASME EV-Kart Team.

{{personalized_connection}}

Our students design, manufacture, assemble, and test an electric racing kart and its in-house battery system. We are currently seeking {{specific_request}}. This support would allow our team to {{specific_use}} while giving students practical experience with tools and materials used in modern engineering and manufacturing.

In return, we can provide {{selected_benefits}}. We can also share project photos, progress updates, and examples showing how your equipment or materials were used.

{{custom_message}}

Would {{company_name}} be open to a short conversation about an equipment, material, educational-discount, store-credit, refurbished-unit, or other in-kind partnership?

Thank you for supporting student engineering and electric-vehicle development at Purdue University Indianapolis.

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
    name: 'Indianapolis Community Partner',
    category: 'Local',
    description: 'For local businesses where community visibility and student engagement are central.',
    subjectTemplate: 'Local Partnership Opportunity | {{company_name}} + Purdue Indianapolis ASME',
    bodyTemplate: `Hello {{contact_first_name}},

My name is {{sender_name}}, and I represent the Purdue University Indianapolis chapter of the American Society of Mechanical Engineers.

{{personalized_connection}}

Our chapter gives students practical engineering experience through an EV-Kart team and small-projects program. Members work on design, fabrication, electrical systems, manufacturing, testing, race operations, and project management while building relationships with engineers and businesses throughout Indianapolis.

We are seeking {{specific_request}} to help us {{specific_use}}.

In return, we would be pleased to provide {{selected_benefits}}. We would also welcome an opportunity for your team to meet our members or learn more about the engineering work happening on the Indianapolis campus.

{{custom_message}}

Would you be available for a short introductory conversation in the next two weeks?

Thank you for considering a partnership with Purdue Indianapolis student engineers.

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME
asmeindy@purdue.edu`,
    active: true
  },
  {
    id: 'TPL-RECRUITING',
    name: 'Engineering Employer & Recruiting Partner',
    category: 'Recruiting',
    description: 'Connects sponsorship with appropriate access to developing engineering talent.',
    subjectTemplate: 'Connect {{company_name}} with Purdue Indianapolis Engineering Students',
    bodyTemplate: `Hello {{contact_first_name}},

My name is {{sender_name}}, and I am reaching out from the Purdue University Indianapolis chapter of the American Society of Mechanical Engineers.

{{personalized_connection}}

Our members gain practical experience through the design, fabrication, electrical development, testing, and management of student engineering projects. Our largest current initiative is an electric racing kart with an in-house battery system that students continue to redesign and improve.

We are seeking {{specific_request}} to support {{specific_use}}.

In return, we can provide {{selected_benefits}} and explore appropriate opportunities for your organization to engage with students through a technical presentation, project review, facility conversation, or networking event.

{{custom_message}}

Would you be interested in discussing a partnership that combines project support with meaningful student engagement?

Thank you for your consideration.

Best,
{{sender_name}}
{{sender_role}}
Purdue University Indianapolis ASME
asmeindy@purdue.edu`,
    active: true
  },
  {
    id: 'TPL-FOLLOWUP',
    name: 'No-Response Follow-Up',
    category: 'Follow-up',
    description: 'A respectful follow-up that makes it easy to redirect the request to the right person.',
    subjectTemplate: 'Following Up: Purdue Indianapolis ASME + {{company_name}}',
    bodyTemplate: `Hello {{contact_first_name}},

I wanted to follow up on my previous message regarding a potential partnership between {{company_name}} and the Purdue University Indianapolis ASME chapter.

{{personalized_connection}}

We are seeking {{specific_request}} to help us {{specific_use}}. In return, we can provide {{selected_benefits}}.

{{custom_message}}

Would you be the appropriate person to speak with about sponsorships, educational partnerships, or community engagement? If not, I would greatly appreciate being directed to the correct contact.

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
    name: 'Sponsor Thank-You & Confirmation',
    category: 'Stewardship',
    description: 'Confirms the contribution, impact, benefits, and brand assets needed from a sponsor.',
    subjectTemplate: 'Thank You for Supporting Purdue Indianapolis ASME',
    bodyTemplate: `Hello {{contact_first_name}},

On behalf of the Purdue University Indianapolis ASME chapter, thank you for supporting our students through {{specific_request}}.

Your support will help us {{specific_use}}.

As part of the partnership, we have recorded the following sponsor benefits: {{selected_benefits}}.

{{custom_message}}

To prepare your recognition materials, please send your preferred company name, a high-resolution or vector logo, any brand-use requirements, your preferred website link, and the appropriate contact for future updates.

We are grateful to have {{company_name}} as a partner and look forward to sharing the progress your support makes possible.

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
    'Enter only the origin, such as https://yourusername.github.io (do not include the repository path). You can change this later.',
    ui.ButtonSet.OK_CANCEL
  );
  if (originPrompt.getSelectedButton() !== ui.Button.OK) return;

  setupSponsorFlow_();
  setAdminPassword_(passwordPrompt.getResponseText());
  setFrontendOrigin_(originPrompt.getResponseText());
  ui.alert('SponsorFlow setup is complete. Next, deploy this script as a web app.');
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
      case 'getRequest': data = getRequest_(p); break;
      case 'reviseRequest': data = reviseRequest_(p); break;
      default: throw new Error('Unknown SponsorFlow action.');
    }
    return bridgeResponse_(origin, callId, { ok: true, data: data });
  } catch (error) {
    return bridgeResponse_(origin, callId, { ok: false, error: cleanError_(error) });
  }
}

function setupSponsorFlow_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('SponsorFlow must be bound to a Google Sheet.');
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', spreadsheet.getId());
  if (!props.getProperty('APP_SALT')) props.setProperty('APP_SALT', Utilities.getUuid() + Utilities.getUuid());

  Object.keys(SF.HEADERS).forEach(name => ensureSheet_(spreadsheet, name, SF.HEADERS[name]));
  const templateSheet = spreadsheet.getSheetByName(SF.SHEETS.TEMPLATES);
  if (templateSheet.getLastRow() <= 1) {
    const now = nowIso_();
    DEFAULT_TEMPLATES.forEach(template => appendObject_(SF.SHEETS.TEMPLATES, Object.assign({}, template, { createdAt: now, updatedAt: now })));
  }
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  const existing = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  if (existing.join('|') !== headers.join('|')) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), headers.length).setNumberFormat('@');
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#cfb991');
  sheet.autoResizeColumns(1, headers.length);
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
  return HtmlService.createHtmlOutput(`<!doctype html><meta charset="utf-8"><script>window.top.postMessage(${safeMessage},${safeOrigin});</script>`);
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
  return { contacts: contacts, templates: templates, version: SF.VERSION };
}

function createRequest_(p) {
  return withWriteLock_(function () {
    const id = requirePattern_(p.requestId, /^REQ-[A-Z2-9]{8}$/, 'Invalid request ID.');
    if (findObjectById_(SF.SHEETS.REQUESTS, id)) throw new Error('That request ID already exists. Please submit again.');
    const accessCode = requirePattern_(String(p.accessCode || '').toUpperCase(), /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/, 'Invalid edit code.');
    const requesterName = requireText_(p.requesterName, 'Your name', 2, 80);
    const requesterRole = optionalText_(p.requesterRole, 80);
    const contact = findObjectById_(SF.SHEETS.CONTACTS, requireText_(p.contactId, 'Sponsor contact', 1, 80));
    if (!contact || !toBool_(contact.verified) || !toBool_(contact.active)) throw new Error('The selected sponsor contact is no longer available.');
    const template = findObjectById_(SF.SHEETS.TEMPLATES, requireText_(p.templateId, 'Template', 1, 80));
    if (!template || !toBool_(template.active)) throw new Error('The selected email template is no longer available.');
    const subject = requireText_(p.subject, 'Subject', 10, 200);
    const body = requireText_(p.body, 'Email body', 100, 12000);
    if (/{{[^}]+}}/.test(subject + body)) throw new Error('Resolve every template placeholder before submitting.');
    const now = nowIso_();
    const record = {
      id: id,
      accessHash: accessHash_(accessCode),
      requesterName: requesterName,
      requesterNameKey: normalizeNameKey_(requesterName),
      requesterRole: requesterRole,
      contactId: contact.id,
      companyName: contact.companyName,
      contactName: contact.contactName,
      contactEmail: contact.email,
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
    appendAudit_(id, 'REQUEST_SUBMITTED', requesterName, `Revision 1 for ${contact.companyName}`);
    return { requestId: id, status: record.status };
  });
}

function getRequest_(p) {
  const id = requirePattern_(String(p.requestId || '').toUpperCase(), /^REQ-[A-Z2-9]{8}$/, 'Invalid request ID.');
  const accessCode = requirePattern_(String(p.accessCode || '').toUpperCase(), /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/, 'Invalid edit code.');
  const record = findObjectById_(SF.SHEETS.REQUESTS, id);
  if (!record || !constantTimeEqual_(record.accessHash, accessHash_(accessCode))) throw new Error('The request ID or edit code is incorrect.');
  return publicRequest_(record);
}

function reviseRequest_(p) {
  return withWriteLock_(function () {
    const id = requirePattern_(String(p.requestId || '').toUpperCase(), /^REQ-[A-Z2-9]{8}$/, 'Invalid request ID.');
    const accessCode = requirePattern_(String(p.accessCode || '').toUpperCase(), /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/, 'Invalid edit code.');
    const record = findObjectById_(SF.SHEETS.REQUESTS, id);
    if (!record || !constantTimeEqual_(record.accessHash, accessHash_(accessCode))) throw new Error('The request ID or edit code is incorrect.');
    if (record.status !== 'CHANGES_REQUESTED') throw new Error('This request is not currently open for revision.');
    const requesterName = requireText_(p.requesterName, 'Your name', 2, 80);
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
    .map(row => Object.assign({}, row, { revisionNumber: Number(row.revisionNumber || 1) }))
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
  const headers = SF.HEADERS[name];
  const values = headers.map(header => encodeCell_(object[header] == null ? '' : object[header]));
  sheet_(name).appendRow(values);
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

// -------------------------- Validation and security helpers --------------------------

function accessHash_(accessCode) {
  return sha256_(PropertiesService.getScriptProperties().getProperty('APP_SALT') + String(accessCode).toUpperCase());
}

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
