/**
 * Copyright 2018 Paul kotlyar. All Rights Reserved.
 */


var SIDEBAR_TITLE = 'Send this form to TeamSnap members';

/**
 * Adds a custom menu with items to show the sidebar.
 * @param {Object} e The event parameter for a simple onOpen trigger.
 */
function onOpen(e) {
  FormApp.getUi()
      .createAddonMenu()
      .addItem(SIDEBAR_TITLE, 'showSidebar')
      .addToUi();
}

/**
 * Runs when the add-on is installed; calls onOpen() to ensure menu creation and
 * any other initializion work is done immediately.
 * @param {Object} e The event parameter for a simple onInstall trigger.
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Opens a sidebar. The sidebar structure is described in the Sidebar.html
 * project file.
 */
function showSidebar() {
  var service = getTSAuthService_();
  var template = HtmlService.createTemplateFromFile('Sidebar');
  
  template.email = Session.getEffectiveUser().getEmail();
  template.isSignedIn = service.hasAccess();
  var page = template.evaluate()
      .setTitle(SIDEBAR_TITLE)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  
  ensureMemberIdAndMemberNameFieldsPresentOnForm();
  
  page.setWidth(600);
  page.setHeight(800);
  
  FormApp.getUi().showModalDialog(page,SIDEBAR_TITLE);
}

/**
 * Builds and returns the authorization URL from the service object.
 * @return {String} The authorization URL.
 */
function getAuthorizationUrl() {
  return getTSAuthService_().getAuthorizationUrl();
}

/**
 * Resets the API service, forcing re-authorization before
 * additional authorization-required API calls can be made.
 */
function signOut() {
  getTSAuthService_().reset();
}



/**
 * Gets an OAuth2 service configured for the GitHub API.
 * @return {OAuth2.Service} The OAuth2 service
 */
function getTSAuthService_() {
  
    var scriptProperties = PropertiesService.getScriptProperties();
  
  var clientID  = scriptProperties.getProperty("TS_CLIENT_ID");
  var clientSecret = scriptProperties.getProperty("TS_CLIENT_SECRET");
  
  return OAuth2.createService('TeamSnap')
  // Set the endpoint URLs.
  .setAuthorizationBaseUrl('https://auth.teamsnap.com/oauth/authorize')
  .setTokenUrl('https://auth.teamsnap.com/oauth/token')

  // Set the client ID and secret.
  .setClientId(clientID)
  .setClientSecret(clientSecret)

  // Set the name of the callback function that should be invoked to complete
  // the OAuth flow.
  .setCallbackFunction('authCallback_')

  // Set the property store where authorized tokens should be persisted.
  .setPropertyStore(PropertiesService.getUserProperties());
}

/**
 * Callback handler that is executed after an authorization attempt.
 * @param {Object} request The results of API auth request.
 */
function authCallback_(request) {
  var template = HtmlService.createTemplateFromFile('Callback');
  template.email = Session.getEffectiveUser().getEmail();
  template.isSignedIn = false;
  template.error = null;
  var title;
  try {
    var service = getTSAuthService_();
    var authorized = service.handleCallback(request);
    template.isSignedIn = authorized;
    title = authorized ? 'Access Granted' : 'Access Denied';
  } catch (e) {
    template.error = e;
    title = 'Access Error';
  }
  template.title = title;
  return template.evaluate()
      .setTitle(title)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

/**
 * Logs the redict URI to register in the Google Developers Console.
 */
function logRedirectUri() {
  var service = getTSAuthService_();
  Logger.log(service.getRedirectUri());
}

/**
 * Includes the given project HTML file in the current HTML project file.
 * Also used to include JavaScript.
 * @param {String} filename Project file name.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Gets the user's TeamSnap profile.
 */
function getTSProfileProfile() {
  var service = getTSAuthService_();
  if (!service.hasAccess()) {
    throw new Error('Error: Missing TeamSnap authorization.');
  }
  var url = 'https://apiv3.teamsnap.com/v3/me';
  var response = UrlFetchApp.fetch(url, {
    headers: {
      Authorization: 'Bearer ' + service.getAccessToken()
    }
  });
  var cJson =  JSON.parse(response.getContentText());
  
  var dataItem = cJson.collection.items[0];
  
  var res = {
    
    "id": findValueInCollectionJson(dataItem, 'id'),
    "email":findValueInCollectionJson(dataItem, 'email')
  };
  
  return res;
}




/**
 * Gets the user's TeamSnap profile.
 */
function getTSActiveTeams(userId) {

  if(!userId)
  {
    throw new Error('Error: Missing TeamSnap userId.');
  }
  

  var service = getTSAuthService_();
  if (!service.hasAccess()) {
    throw new Error('Error: Missing TeamSnap authorization.');
  }
  var url = 'https://apiv3.teamsnap.com/v3/teams/active?user_id=' + userId;
  var response = UrlFetchApp.fetch(url, {
    headers: {
      Authorization: 'Bearer ' + service.getAccessToken()
    }
  });
  var cJson =  JSON.parse(response.getContentText());
  
  var teams = [];
  
  cJson.collection.items.forEach(function (di){
  
    teams.push({"id": findValueInCollectionJson(di, "id") , "name": findValueInCollectionJson(di, "name") });
    
  });
  
    
  return teams;
}


/**
 * Gets the user's TeamSnap profile.
 */
function getTSMembersWhichCanBeEmailed(teamId) {

  if(!teamId)
  {
    throw new Error('Error: Missing TeamSnap teamId.');
  }
  
  var service = getTSAuthService_();
  if (!service.hasAccess()) {
    throw new Error('Error: Missing TeamSnap authorization.');
  }
  var url = 'https://apiv3.teamsnap.com/v3/members/search?team_id=' + teamId;
  var response = UrlFetchApp.fetch(url, {
    headers: {
      Authorization: 'Bearer ' + service.getAccessToken()
    }
  });
  var cJson =  JSON.parse(response.getContentText());
  
  var members = [];
  
  cJson.collection.items.forEach(function (di){
     
    if(findValueInCollectionJson(di, "is_emailable"))
    {
    
      members.push({"id": findValueInCollectionJson(di, "id") , "emailAddresses": findValueInCollectionJson(di, "email_addresses"), "firstName": findValueInCollectionJson(di, "first_name"), "lastName": findValueInCollectionJson(di, "last_name"), "isNonPlayer": findValueInCollectionJson(di, "is_non_player")  });
    
    }
    
  });
     
  return members;
}

function emailForm(request)
{
  
  if(MailApp.getRemainingDailyQuota() < request.members.length)
    throw new Error("Email Quota too low! " +  MailApp.getRemainingDailyQuota());

  
  var count = 0;
  
  var fieldInfo = ensureMemberIdAndMemberNameFieldsPresentOnForm();
   
  request.members.forEach(function(m){
  
    m.member.emailAddresses.forEach(function(e){
         
      var memberName =  m.member.firstName + ' ' +  m.member.lastName;
      
      var formLink = buildPrefilledFormUrl(m.member.id, memberName,fieldInfo);
             
      var email = {
        to: 'paul_kotlyar@hotmail.com',
        subject: '['+ request.team.name.toUpperCase() + ']' + request.subject,     
        name: request.team.name.toUpperCase(),       
        htmlBody: request.body + "<br><br>" +
        "<a href='" + formLink + "'>Here</a> is a link to this form."}
        
        MailApp.sendEmail(email);
      
       count++;
      
    });
  
  
  });
  
  FormApp.getUi().alert(count +  ' Notifications were sent.');
}

function buildPrefilledFormUrl(memberId, memberName, fieldInfo) {  

 var form = FormApp.getActiveForm();  
   
 var formResponse = form.createResponse();
 
 var memberIdField = fieldInfo.memberIdField.asTextItem();
  
 var memberNameField = fieldInfo.memberNameField.asTextItem();
    
  var response = memberIdField.createResponse(memberId.toString());     
  
  formResponse.withItemResponse(response);
  
  var response2 = memberNameField.createResponse(memberName.toString());        
 
  formResponse.withItemResponse(response2);

  //Creates URL with pre-filled data
  var url = formResponse.toPrefilledUrl();

  return url;
  //Mail the link to the people required.
}


/**
 * Finds value in CollectionJson items array
 *  collection.items[0] needs to be passed as first arg
 */
function findValueInCollectionJson(itemsObj, dataItemName)
{
     
  for (var i = 0; i < itemsObj.data.length; i++) {
  
    if(itemsObj.data[i].name===dataItemName)
    {
      return itemsObj.data[i].value;
      
    }
    
  }
      
   return null;
}


var MEMBER_ID_FIELD_NAME='TSMemberId';

var MEMBER_NAME_FIELD_NAME='TSMemberName';

function ensureMemberIdAndMemberNameFieldsPresentOnForm()
{
  var form = FormApp.getActiveForm();
  
  var memberIdField = findTextFieldByName(MEMBER_ID_FIELD_NAME);
  
  var memberNameField = findTextFieldByName(MEMBER_NAME_FIELD_NAME);
 
  if(!memberIdField)
  {
     memberNameField= createTextFieldByName(MEMBER_NAME_FIELD_NAME);  
    
     memberIdField = createTextFieldByName(MEMBER_ID_FIELD_NAME);
    
  }
    
  return {memberIdField:memberIdField, memberNameField:memberNameField};
}


function createTextFieldByName(name)
{
  var form = FormApp.getActiveForm();
  
  var item = form.addTextItem();
 
  item.setRequired(true);
  
  item.setTitle(name);
  
  //form.moveItem(findTextFieldByName(name), 0); //TODO: figure out how to move before first page break.
  
  return item;
}

function findTextFieldByName(name)
{
  var form = FormApp.getActiveForm();
  var textItems = form.getItems(FormApp.ItemType.TEXT);
  
 for (var i = 0; i < textItems.length; i++) {
   
   var item = textItems[i];
   
   if(item.getTitle() === name)
   {
 
     return item;
     
   }
 }
  
  return null;
}

