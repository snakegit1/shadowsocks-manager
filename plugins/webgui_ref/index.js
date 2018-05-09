const knex = appRequire('init/knex').knex;

const getRefSetting = async () => {
  const setting = await knex('webguiSetting').select().where({
    key: 'webgui_ref',
  }).then(success => {
    if(!success.length) {
      return Promise.reject('settings not found');
    }
    success[0].value = JSON.parse(success[0].value);
    return success[0].value;
  });
  return setting;
};

const addRefCode = async (userId, max = 3) => {
  const code = Math.random().toString().substr(2, 10);
  await knex('webgui_ref_code').insert({
    code,
    sourceUserId: userId,
    maxUser: max,
    time: Date.now(),
  });
};

const visitRefCode = async code => {
  const setting = await getRefSetting();
  if(!setting.useRef) { return; }
  await knex('webgui_ref_code').where({ code }).increment('visit', 1);
};

const addRefUser = async (code, userId) => {
  try {
    const setting = await getRefSetting();
    if(!setting.useRef) { return; }
    const codeInfo = (await knex('webgui_ref_code').where({ code }))[0];
    if(!codeInfo) { return; }
    const sourceUserInfo = (await knex('user').where({ id: codeInfo.sourceUserId }))[0];
    if(!sourceUserInfo) { return; }
    const currentRefUser = await knex('webgui_ref').where({ codeId: codeInfo.id });
    if(currentRefUser.length >= codeInfo.maxUser) {
      return;
    }
    await knex('webgui_ref').insert({
      codeId: codeInfo.id,
      userId,
      time: Date.now(),
    });
    await knex('user').update({ group: sourceUserInfo.group }).where({ id: userId });
  } catch(err) {
    console.error(err);
  }
};

const getUserRefCode = async userId => {
  const setting = await getRefSetting();
  const exists = await knex('webgui_ref_code').where({ sourceUserId: userId });
  if(exists.length < setting.refNumber) {
    for(let i = 0; i < setting.refNumber - exists.length; i++) {
      await addRefCode(userId, setting.refUserNumber);
    }
  }
  const code = await knex('webgui_ref_code').select([
    'webgui_ref_code.code as code',
    'webgui_ref_code.maxUser as maxUser',
    knex.raw('count(webgui_ref.codeId) as count'),
  ]).where({ sourceUserId: userId })
  .leftJoin('webgui_ref', 'webgui_ref_code.id', 'webgui_ref.codeId')
  .groupBy('webgui_ref_code.id');
  return code;
};

exports.addRefCode = addRefCode;
exports.visitRefCode = visitRefCode;
exports.addRefUser = addRefUser;
exports.getUserRefCode = getUserRefCode;

const setDefaultValue = (key, value) => {
  knex('webguiSetting').select().where({
    key,
  }).then(success => {
    if(success.length) {
      return;
    }
    return knex('webguiSetting').insert({
      key,
      value: JSON.stringify(value),
    });
  }).then();
};
setDefaultValue('webgui_ref', {
  useRef: false,
  useWhenSignupClose: false,
  refNumber: 1,
  refUserNumber: 1,
});