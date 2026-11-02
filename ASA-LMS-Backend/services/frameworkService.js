const Module = require('../models/module');
const Lesson = require('../models/lession');
const Content = require('../models/content');
const Group = require('../models/group');
const Question = require('../models/question');

const groupUpdate = async (id) => {
    const group = await Group.findById(id);
    const groupQuestions = await Question.find({ group_id: id, active: true, deleted_at: null });
    if(groupQuestions.length <= 0){
        group.is_data = false;
        await group.save();
    } else {
        group.is_data = true;
        await group.save();
    }
    const model_id = group.type === 'lesson' ? group.lesson_id : group.content_id;
    await groupBasedContentOrLessonUpdate(group.type, model_id);
    return true;
}

const groupBasedContentOrLessonUpdate = async (type, model_id) => {
    const Model = type === 'lesson' ? Lesson : Content;
    const [groups, model] = await Promise.all([
        Group.find({ [`${type}_id`]: model_id, is_data: true, active: true, deleted_at: null }),
        Model.findById(model_id)
    ]);
    if(groups.length <= 0){
        model.is_data = false;
        await model.save();
    } else {
        model.is_data = true;
        await model.save();
    }
    if(type === 'lesson'){
        await lessonBasedModuleUpdate(model.module_id);
    } else {
        await contentBasedLessonUpdate(model.lesson_id);
    }
    return true;
}

const contentBasedLessonUpdate = async (lesson_id) => {
    const [content, lesson] = await Promise.all([
        Content.find({ lesson_id: lesson_id, is_data: true, active: true, deleted_at: null }),
        Lesson.findById(lesson_id)
    ]);
    if(content.length <= 0){
        lesson.is_data = false;
        await lesson.save();
    } else {
        lesson.is_data = true;
        await lesson.save();
    }
    await lessonBasedModuleUpdate(lesson.module_id);
    return true;
}

const lessonBasedModuleUpdate = async (module_id) => {
    const [lesson, module] = await Promise.all([
        Lesson.find({ module_id: module_id, is_data: true, active: true, deleted_at: null }),
        Module.findById(module_id)
    ]);
    if(lesson.length <= 0){
        module.is_data = false;
        await module.save();
    } else {
        module.is_data = true;
        await module.save();
    }
    return true;
}

module.exports = {
    contentBasedLessonUpdate,
    lessonBasedModuleUpdate,
    groupUpdate,
    groupBasedContentOrLessonUpdate
}
