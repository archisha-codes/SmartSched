const fs = require('fs');
const modelsToProxy = ['Teacher', 'Classroom', 'Course', 'Student', 'User', 'Program', 'Division', 'SystemConfig', 'Holiday', 'Timetable', 'TimetableSession', 'Query'];
const files = ['routes/algorithms.js', 'routes/queries.js', 'routes/timetable.js', 'routes/timetableSession.js'];

files.forEach(file => {
  let code = fs.readFileSync(file, 'utf8');
  let replaced = false;
  
  modelsToProxy.forEach(model => {
      const regexStr = `const ${model} = require\\('\\.\\./models/${model}'\\);(?:\\r?\\n)?`;
      const regex = new RegExp(regexStr, 'g');
      if (regex.test(code)) {
          code = code.replace(regex, '');
          replaced = true;
      }
  });

  if (replaced) {
      const importStmt = `const { Teacher, Classroom, Course, Student, User, Program, Division, SystemConfig, Holiday, Timetable, TimetableSession, Query } = require('../utils/mongooseToPrisma');\n`;
      code = code.replace(/(const express = require\('express'\);\r?\n)/, `$1${importStmt}`);
      fs.writeFileSync(file, code);
      console.log(`Patched ${file}`);
  }
});
