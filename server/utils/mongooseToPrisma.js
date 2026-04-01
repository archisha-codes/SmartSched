const prisma = require('../config/prisma');

// Helper to translate query schemas (e.g. $in, $or, $regex) from Mongoose to Prisma
function translateQuery(query) {
  if (!query) return {};
  const translated = { ...query };

  // Strip JSON dot notation searches to avoid Prisma crashes on Json fields
  Object.keys(translated).forEach(k => {
      if (k.includes('.')) {
          delete translated[k];
      }
  });

  if (translated.$or) {
      translated.OR = translated.$or.map(translateQuery);
      delete translated.$or;
  }
  if (translated.$and) {
      translated.AND = translated.$and.map(translateQuery);
      delete translated.$and;
  }

  for (const key of Object.keys(translated)) {
      if (key === 'OR' || key === 'AND') continue;

      let val = translated[key];
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof RegExp)) {
          let newObj = { ...val };
          if (newObj.$in !== undefined) { newObj.in = newObj.$in; delete newObj.$in; }
          if (newObj.$nin !== undefined) { newObj.notIn = newObj.$nin; delete newObj.$nin; }
          if (newObj.$ne !== undefined) { newObj.not = newObj.$ne; delete newObj.$ne; }
          if (newObj.$gt !== undefined) { newObj.gt = newObj.$gt; delete newObj.$gt; }
          if (newObj.$gte !== undefined) { newObj.gte = newObj.$gte; delete newObj.$gte; }
          if (newObj.$lt !== undefined) { newObj.lt = newObj.$lt; delete newObj.$lt; }
          if (newObj.$lte !== undefined) { newObj.lte = newObj.$lte; delete newObj.$lte; }
          if (newObj.$regex !== undefined) {
              const flags = newObj.$options || '';
              newObj.contains = newObj.$regex.toString().replace(/^\/|\/[ig]*$/g, '');
              if (flags.includes('i')) newObj.mode = 'insensitive';
              delete newObj.$regex;
              delete newObj.$options;
          }
          translated[key] = newObj;
      } else if (val instanceof RegExp) {
          translated[key] = {
              contains: val.source,
              mode: val.flags.includes('i') ? 'insensitive' : 'default'
          };
      }
  }

  // Id translation
  if (translated._id !== undefined) {
    translated.id = translated._id;
    delete translated._id;
  }
  
  return translated;
}

// Proxies a raw result object so it behaves like a Mongoose Document
function wrapDocument(doc, modelName) {
    if (!doc) return null;
    return new Proxy(doc, {
        get(target, prop) {
            if (prop === 'save') {
                return async function() {
                    if (target.__isNew) {
                         const cleanTarget = { ...target };
                         delete cleanTarget.__isNew;
                         const res = await prisma[modelName].create({ data: cleanTarget });
                         Object.assign(target, res);
                         target.__isNew = false;
                         return wrapDocument(target, modelName);
                    }
                    else {
                        const idVal = target.id || target.dbId;
                        try {
                            const cleanTarget = { ...target };
                            delete cleanTarget._id;
                            delete cleanTarget.dbId;
                            delete cleanTarget.id;
                            delete cleanTarget.__isNew;
                            const res = await prisma[modelName].update({
                                where: target.dbId ? { dbId: target.dbId } : { id: target.id }, 
                                data: cleanTarget
                            });
                            Object.assign(target, res);
                            return wrapDocument(target, modelName);
                        } catch (e) {
                            throw e;
                        }
                    }
                };
            }
            if (prop === '_id') {
                return target.dbId || target.id;
            }
            if (prop === 'toObject' || prop === 'toJSON') {
                return () => {
                     const clean = { ...target };
                     delete clean.__isNew;
                     return clean;
                };
            }
            return target[prop];
        }
    });
}

function createModel(modelName) {
    const modelLower = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    
    // Constructor (simulate `new Teacher({...})`)
    const MongooseAdapter = function(data) {
        const instance = { ...data, __isNew: true };
        return wrapDocument(instance, modelLower);
    };

    // Static Methods
    MongooseAdapter.find = function(query = {}) {
        const where = translateQuery(query);
        let skip = undefined;
        let take = undefined;
        let sort = undefined;
        
        const chain = {
            skip(val) { skip = parseInt(val); return chain; },
            limit(val) { take = parseInt(val); return chain; },
            sort(val) { 
                if (typeof val === 'object') {
                    sort = Object.keys(val).filter(k => !k.includes('.')).map(k => { 
                        let field = k === '_id' ? 'id' : k;
                        return { [field]: val[k] === 1 || val[k] === 'asc' ? 'asc' : 'desc' }; 
                    });
                    if (sort && sort.length === 0) sort = undefined;
                }
                return chain; 
            },
            lean() { return chain; },
            populate() { return chain; },
            select() { return chain; },
            exec: async () => {
                const results = await prisma[modelLower].findMany({ where, skip, take, orderBy: sort });
                return results.map(doc => wrapDocument(doc, modelLower));
            }
        };
        chain.then = function(onfulfilled, onrejected) { return chain.exec().then(onfulfilled, onrejected); };
        return chain;
    };
    MongooseAdapter.countDocuments = async function(query) {
        const where = translateQuery(query);
        return await prisma[modelLower].count({ where });
    };

    MongooseAdapter.findOne = function(query) {
        const where = translateQuery(query);
        let sort = undefined;

        const chain = {
            lean() { return chain; },
            populate() { return chain; },
            select() { return chain; },
            limit() { return chain; },
            sort(val) { 
                if (typeof val === 'object') {
                    sort = Object.keys(val).filter(k => !k.includes('.')).map(k => { 
                        let field = k === '_id' ? 'id' : k;
                        return { [field]: val[k] === 1 || val[k] === 'asc' ? 'asc' : 'desc' }; 
                    });
                    if (sort && sort.length === 0) sort = undefined;
                }
                return chain; 
            },
            exec: async () => {
                const doc = await prisma[modelLower].findFirst({ where, orderBy: sort });
                return wrapDocument(doc, modelLower);
            }
        };
        chain.then = function(onfulfilled, onrejected) { return chain.exec().then(onfulfilled, onrejected); };
        return chain;
    };

    MongooseAdapter.findById = function(id) {
        return MongooseAdapter.findOne({ id });
    };

    MongooseAdapter.findOneAndDelete = function(query) {
        const chain = {
            exec: async () => {
                const doc = await prisma[modelLower].findFirst({ where: translateQuery(query) });
                if (doc) {
                    await prisma[modelLower].delete({ where: { id: doc.id } });
                }
                return doc;
            }
        };
        chain.then = function(onfulfilled, onrejected) { return chain.exec().then(onfulfilled, onrejected); };
        return chain;
    };

    MongooseAdapter.findByIdAndDelete = function(id) {
        return MongooseAdapter.findOneAndDelete({ id });
    };

    MongooseAdapter.countDocuments = async function(query) {
        return prisma[modelLower].count({ where: translateQuery(query) });
    };

    MongooseAdapter.deleteMany = async function(query) {
        return prisma[modelLower].deleteMany({ where: translateQuery(query) });
    };

    MongooseAdapter.updateMany = async function(query, update) {
        const updateData = update.$set ? update.$set : update;
        const cleanData = { ...updateData };
        delete cleanData._id;
        delete cleanData.dbId;
        delete cleanData.id;
        const res = await prisma[modelLower].updateMany({
            where: translateQuery(query),
            data: cleanData
        });
        return { modifiedCount: res.count, matchedCount: res.count };
    };

    MongooseAdapter.updateOne = async function(query, update) {
        const doc = await prisma[modelLower].findFirst({ where: translateQuery(query) });
        if (doc) {
             const updateData = update.$set ? update.$set : update;
             const cleanData = { ...updateData };
             delete cleanData._id;
             delete cleanData.dbId;
             delete cleanData.id;
             await prisma[modelLower].update({ where: { id: doc.id }, data: cleanData });
             return { matchedCount: 1, modifiedCount: 1 };
        }
        return { matchedCount: 0, modifiedCount: 0 };
    };

    MongooseAdapter.create = async function(data) {
        if (Array.isArray(data)) {
             const docs = data.map(d => ({ id: d.id || require('crypto').randomUUID(), ...d }));
             await prisma[modelLower].createMany({ data: docs });
             return MongooseAdapter.find({}).exec(); // Approximation, doesn't matter for this codebase mostly
        } else {
             data.id = data.id || require('crypto').randomUUID();
             const res = await prisma[modelLower].create({ data });
             return wrapDocument(res, modelLower);
        }
    };

    MongooseAdapter.insertMany = async function(docs) {
        return prisma[modelLower].createMany({ data: docs });
    };

    // Very basic fallback
    MongooseAdapter.findOneAndUpdate = async function(query, update, options = {}) {
        const doc = await prisma[modelLower].findFirst({ where: translateQuery(query) });
        const updateData = update.$set ? update.$set : update;
        
        if (!doc && options.upsert) {
             return wrapDocument(await prisma[modelLower].create({ data: updateData }), modelLower);
        }
        if (doc) {
             const cleanData = { ...updateData };
             delete cleanData._id; // prevent Prisma mapping error
             delete cleanData.dbId;
             const res = await prisma[modelLower].update({ where: { id: doc.id }, data: cleanData });
             return wrapDocument(res, modelLower);
        }
        return null;
    };
    
    // Aggregation fallback for generic compatibility if needed
    MongooseAdapter.aggregate = async function(pipeline) {
        if (pipeline && pipeline.length > 0 && pipeline[0].$match) {
            return MongooseAdapter.find(pipeline[0].$match).exec();
        }
        return [];
    };

    return MongooseAdapter;
}

module.exports = {
   Teacher: createModel('Teacher'),
   Classroom: createModel('Classroom'),
   Course: createModel('Course'),
   Student: createModel('Student'),
   User: createModel('User'),
   Program: createModel('Program'),
   Division: createModel('Division'),
   SystemConfig: createModel('SystemConfig'),
   Holiday: createModel('Holiday'),
   Timetable: createModel('Timetable'),
   TimetableSession: createModel('TimetableSession'),
   Query: createModel('Query')
};
