const Group = require('../models/group');
const Question = require('../models/question');
const Content = require('../models/content');
const Lesson = require('../models/lession');
const Progress = require('../models/progress');
const Module = require('../models/module');
const AssignedCourse = require('../models/assignedCourse');
const Course = require('../models/course');
const mongoose = require('mongoose');

const getQuestion = async (data, sort = 1, user_id, course_id, module_id) => {
    const { id, type, o_type, name } = data;
    if(o_type === 'question'){
     let groupPrevData = null;
     if(sort === -1){
        const prevProgress = await Progress.findOne({
            user_id: user_id,
            course_id: course_id,
            module_id: module_id,
            [`${type}_id`]: id,
            model: 'question'
        }).sort({ _id: -1 });
        groupPrevData = prevProgress ? prevProgress.group_id : null;
     }
     const question = await getQuestionData(id, type, sort, groupPrevData);
     return question ? 
     { 
        id: question.data._id, 
        type: 'group', 
        self_evaluation: question.self_evaluation,
        content_id: question.content_id,
        lesson_id: question.lesson_id
     } : { 
        id: null, 
        type: 'group', 
        self_evaluation: false,
        content_id: null,
        lesson_id: null
     };
    } else if(type === 'lesson' && o_type === 'content'){
     const content = await Content.findOne({ lesson_id: id, active: true, is_data: true, deleted_at: null, type: { $ne: null } })
         .select('_id name type lesson_id')
         .sort({ _id: sort })
         .lean();
     if(content.type === 'question'){
         const question = await getQuestionData(content._id, 'content', sort);
         return question ? 
         { 
            id: question.data._id, 
            type: 'group', 
            self_evaluation: question.self_evaluation,
            content_id: question.content_id,
            lesson_id: question.lesson_id
         } : { 
            id: null, 
            type: 'group', 
            self_evaluation: false,
            content_id: null,
            lesson_id: null
         };
     }
     return { 
        id: content._id, 
        type: 'content', 
        self_evaluation: false,
        content_id: content._id,
        lesson_id: content.lesson_id,
     };
    }
    let content_id = type === 'content' ? id : null;
    let lesson_id = type === 'lesson' ? id : null;
    if(type === 'content'){
        const content = await Content.findById(id).lean();
        lesson_id = content.lesson_id;
    }
    return { id, type, self_evaluation: false, content_id, lesson_id };
 }
 
 const getQuestionData = async (id, type, sort, group_id = null) => {
     const groupData = await Group.find({
         $or: [
            { _id: group_id },
            {
                [`${type}_id`]: id, 
                active: true, 
                is_data: true, 
                deleted_at: null 
            }
        ]
     })
         .select('_id name type')
         .populate('content_id')
         .populate('lesson_id')
         .sort({ _id: sort })
         .lean();
    const groupIds = groupData.map(group => group._id);
    const question = await Question.findOne({ 
        $or:[
            { group_id: group_id },
            {
                group_id: { $in: groupIds }, 
                active: true, 
                deleted_at: null 
            }
        ]
    })
         .select('_id question group_id')
         .sort({ group_id: sort, _id: sort })
         .lean();

    const group = await Group.findById(question.group_id).lean();
    
    let self_evaluation = false;
    if(sort === -1){
        const groupData = await Group.find({ 
            $or: [
                { _id: group_id },
                {
                    [`${type}_id`]: id, 
                    active: true, 
                    is_data: true, 
                    deleted_at: null 
                }
            ]
        })
        .select('_id name')
        .lean();
        const groupIds = groupData.map(group => group._id);
        const questionData = await Question.find({ 
            $or: [
                { group_id: group_id },
                {
                    group_id: { $in: groupIds }, 
                    active: true, 
                    deleted_at: null 
                }
            ],
            type: { $in: ['multi_choice'] },
        })
        .select('_id question')
        .lean();
        if(questionData.length > 0){
            self_evaluation = true;
        }
    }
    let content_id = null;
    let lesson_id = null;
    if(group.type === 'content'){
        content_id = group.content_id._id;
        lesson_id = group.content_id.lesson_id;
    } else if(group.type === 'lesson'){
        lesson_id = group.lesson_id._id;
    }
     return { data: question, self_evaluation, content_id, lesson_id };
 }

 const getContent = async (id, user_id, course_id, module_id) => {
    const content = await Content.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(id)
            }
        },
        {
            $lookup: {
                from: 'contents',
                let: { 
                    lessonId: '$lesson_id',
                    currentOrder: '$display_order'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$lesson_id', '$$lessonId'] }
                                ]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: 'progresses',
                            let: { contentId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ['$user_id', new mongoose.Types.ObjectId(user_id)] },
                                                { $eq: ['$course_id', new mongoose.Types.ObjectId(course_id)] },
                                                { $eq: ['$module_id', new mongoose.Types.ObjectId(module_id)] },
                                                { $eq: ['$lesson_id', '$$lessonId'] },
                                                { $eq: ['$content_id', '$$contentId'] },
                                                { $eq: ['$model', 'content'] },
                                                { $eq: ['$active', true] },
                                                { $eq: ['$deleted_at', null] }
                                            ]
                                        }
                                    }
                                },
                                {
                                    $sort: { _id: 1 }
                                },
                                {
                                    $project: {
                                        status: 1,
                                        _id: 1
                                    }
                                }
                            ],
                            as: 'progress'
                        }
                    },
                    {
                        $match: {
                            $expr: {
                                $or: [
                                    { $and: [
                                        { $eq: ['$active', true] },
                                        { $eq: ['$deleted_at', null] },
                                        { $eq: ['$is_data', true] },
                                        { $ne: ['$type', null] }
                                    ]},
                                    { $gt: [{ $size: '$progress' }, 0] }
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            progress_order: {
                                $cond: {
                                    if: { $gt: [{ $size: '$progress' }, 0] },
                                    then: { $first: '$progress._id' },
                                    else: null
                                }
                            },
                            has_progress: {
                                $cond: {
                                    if: { $gt: [{ $size: '$progress' }, 0] },
                                    then: 1,
                                    else: 0
                                }
                            }
                        }
                    },
                    {
                        $sort: {
                            has_progress: -1,
                            progress_order: 1,
                            display_order: 1
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            type: 1,
                            name: 1,
                            display_order: 1
                        }
                    }
                ],
                as: 'all_contents'
            }
        },
        {
            $lookup: {
                from: 'lessons',
                let: { 
                    moduleId: '$module_id',
                    lessonId: '$lesson_id'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$module_id', '$$moduleId'] }
                                ]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: 'progresses',
                            let: { lessonId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ['$user_id', new mongoose.Types.ObjectId(user_id)] },
                                                { $eq: ['$course_id', new mongoose.Types.ObjectId(course_id)] },
                                                { $eq: ['$module_id', new mongoose.Types.ObjectId(module_id)] },
                                                { $eq: ['$lesson_id', '$$lessonId'] },
                                                { $eq: ['$model', 'lesson'] },
                                                { $eq: ['$active', true] },
                                                { $eq: ['$deleted_at', null] }
                                            ]
                                        }
                                    }
                                },
                                {
                                    $sort: { _id: 1 }
                                },
                                {
                                    $project: {
                                        status: 1,
                                        _id: 1
                                    }
                                }
                            ],
                            as: 'progress'
                        }
                    },
                    {
                        $match: {
                            $expr: {
                                $or: [
                                    { $and: [
                                        { $eq: ['$active', true] },
                                        { $eq: ['$deleted_at', null] },
                                        { $eq: ['$is_data', true] },
                                        { $ne: ['$type', null] }
                                    ]},
                                    { $gt: [{ $size: '$progress' }, 0] }
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            progress_order: {
                                $cond: {
                                    if: { $gt: [{ $size: '$progress' }, 0] },
                                    then: { $first: '$progress._id' },
                                    else: null
                                }
                            },
                            has_progress: {
                                $cond: {
                                    if: { $gt: [{ $size: '$progress' }, 0] },
                                    then: 1,
                                    else: 0
                                }
                            }
                        }
                    },
                    {
                        $sort: { 
                            has_progress: -1,
                            progress_order: 1,
                            display_order: 1
                        }
                    },
                ],
                as: 'all_lessons'
            }
        },
        {
            $addFields: {
                currentContentIndex: {
                    $indexOfArray: ['$all_contents._id', '$_id']
                },
                currentLesson: {
                    $arrayElemAt: [
                        {
                            $filter: {
                                input: '$all_lessons',
                                as: 'lesson',
                                cond: { $eq: ['$$lesson._id', '$lesson_id'] }
                            }
                        },
                        0
                    ]
                }
            }
        },
        {
            $addFields: {
                nextLesson: {
                    $arrayElemAt: [
                        {
                            $filter: {
                                input: '$all_lessons',
                                as: 'lesson',
                                cond: { 
                                    $or: [
                                        { $lt: ['$$lesson.has_progress', '$currentLesson.has_progress'] },
                                        { 
                                            $and: [
                                                { $eq: ['$$lesson.has_progress', '$currentLesson.has_progress'] },
                                                { $gt: ['$$lesson.progress_order', '$currentLesson.progress_order'] }
                                            ]
                                        },
                                        {
                                            $and: [
                                                { $eq: ['$$lesson.has_progress', '$currentLesson.has_progress'] },
                                                { $eq: ['$$lesson.progress_order', '$currentLesson.progress_order'] },
                                                { $gt: ['$$lesson.display_order', '$currentLesson.display_order'] }
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        0
                    ]
                },
                previousLesson: {
                    $arrayElemAt: [
                        {
                            $filter: {
                                input: '$all_lessons',
                                as: 'lesson',
                                cond: { 
                                    $or: [
                                        { $gt: ['$$lesson.has_progress', '$currentLesson.has_progress'] },
                                        { 
                                            $and: [
                                                { $eq: ['$$lesson.has_progress', '$currentLesson.has_progress'] },
                                                { $lt: ['$$lesson.progress_order', '$currentLesson.progress_order'] }
                                            ]
                                        },
                                        {
                                            $and: [
                                                { $eq: ['$$lesson.has_progress', '$currentLesson.has_progress'] },
                                                { $eq: ['$$lesson.progress_order', '$currentLesson.progress_order'] },
                                                { $lt: ['$$lesson.display_order', '$currentLesson.display_order'] }
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        -1 
                    ]
                }
            }
        },
        {
            $project: {
                _id: 0,
                previous: {
                    $cond: {
                        if: { $gt: ['$currentContentIndex', 0] },
                        then: { 
                            $let: {
                                vars: {
                                    prevContent: { $arrayElemAt: ['$all_contents', { $subtract: ['$currentContentIndex', 1] }] }
                                },
                                in: {
                                    id: '$$prevContent._id',
                                    type: 'content',
                                    o_type: '$$prevContent.type',
                                    name: '$$prevContent.name'
                                }
                            }
                        },
                        else: {
                            $cond: {
                                if: { $and: [
                                    { $ne: ['$previousLesson', null] },
                                    { $ne: ['$previousLesson', {}] },
                                    { $ne: ['$previousLesson._id', null] }
                                ]},
                                then: {
                                    id: '$previousLesson._id',
                                    type: 'lesson',
                                    o_type: '$previousLesson.type',
                                    name: '$previousLesson.name'
                                },
                                else: null
                            }
                        }
                    }
                },
                next: {
                    $cond: {
                        if: { 
                            $lt: ['$currentContentIndex', { $subtract: [{ $size: '$all_contents' }, 1] }]
                        },
                        then: { 
                            $let: {
                                vars: {
                                    nextContent: { $arrayElemAt: ['$all_contents', { $add: ['$currentContentIndex', 1] }] }
                                },
                                in: {
                                    id: '$$nextContent._id',
                                    type: 'content',
                                    o_type: '$$nextContent.type',
                                    name: '$$nextContent.name'
                                }
                            }
                        },
                        else: {
                            $cond: {
                                if: { $and: [
                                    { $ne: ['$nextLesson', null] },
                                    { $ne: ['$nextLesson', {}] }
                                ]},
                                then: {
                                    id: '$nextLesson._id',
                                    type: 'lesson',
                                    o_type: '$nextLesson.type',
                                    name: '$nextLesson.name'
                                },
                                else: null
                            }
                        }
                    }
                }
            }
        }
    ]);
    return content;
}

const getLesson = async (id, user_id, course_id, module_id) => {
    const lesson = await Lesson.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(id)
            }
        },
        {
            $lookup: {
                from: 'lessons',
                let: { moduleId: '$module_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$module_id', '$$moduleId'] }
                                ]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: 'progresses',
                            let: { lessonId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ['$user_id', new mongoose.Types.ObjectId(user_id)] },
                                                { $eq: ['$course_id', new mongoose.Types.ObjectId(course_id)] },
                                                { $eq: ['$module_id', new mongoose.Types.ObjectId(module_id)] },
                                                { $eq: ['$lesson_id', '$$lessonId'] },
                                                { $eq: ['$model', 'lesson'] },
                                                { $eq: ['$active', true] },
                                                { $eq: ['$deleted_at', null] }
                                            ]
                                        }
                                    }
                                },
                                {
                                    $sort: { _id: 1 }
                                },
                                {
                                    $project: {
                                        status: 1,
                                        _id: 1
                                    }
                                }
                            ],
                            as: 'progress'
                        }
                    },
                    {
                        $match: {
                            $expr: {
                                $or: [
                                    { $and: [
                                        { $eq: ['$active', true] },
                                        { $eq: ['$deleted_at', null] },
                                        { $eq: ['$is_data', true] },
                                        { $ne: ['$type', null] }
                                    ]},
                                    { $gt: [{ $size: '$progress' }, 0] }
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            progress_order: {
                                $cond: {
                                    if: { $gt: [{ $size: '$progress' }, 0] },
                                    then: { $first: '$progress._id' },
                                    else: null
                                }
                            },
                            has_progress: {
                                $cond: {
                                    if: { $gt: [{ $size: '$progress' }, 0] },
                                    then: 1,
                                    else: 0
                                }
                            }
                        }
                    },
                    {
                        $sort: { 
                            has_progress: -1,
                            progress_order: 1,
                            display_order: 1
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            type: 1,
                            display_order: 1
                        }
                    }
                ],
                as: 'all_lessons'
            }
        },
        {
            $addFields: {
                currentIndex: {
                    $indexOfArray: ['$all_lessons._id', '$_id']
                }
            }
        },
        {
            $project: {
                _id: 0,
                previous: {
                    $cond: {
                        if: { $gt: ['$currentIndex', 0] },
                        then: {
                            id: { $arrayElemAt: ['$all_lessons._id', { $subtract: ['$currentIndex', 1] }] },
                            name: { $arrayElemAt: ['$all_lessons.name', { $subtract: ['$currentIndex', 1] }] },
                            o_type: { $arrayElemAt: ['$all_lessons.type', { $subtract: ['$currentIndex', 1] }] },
                            type: 'lesson'
                        },
                        else: null
                    }
                },
                next: {
                    $cond: {
                        if: { $lt: ['$currentIndex', { $subtract: [{ $size: '$all_lessons' }, 1] }] },
                        then: {
                            id: { $arrayElemAt: ['$all_lessons._id', { $add: ['$currentIndex', 1] }] },
                            name: { $arrayElemAt: ['$all_lessons.name', { $add: ['$currentIndex', 1] }] },
                            o_type: { $arrayElemAt: ['$all_lessons.type', { $add: ['$currentIndex', 1] }] },
                            type: 'lesson'
                        },
                        else: null
                    }
                }
            }
        }
    ]);
    return lesson;
}

const checkNullData = async (result, user_id, course_id, module_id) => {
    if (!result.previous || !result.previous.id) {
        result.previous = null;
    }
    if (!result.next || !result.next.id) {
        result.next = null;
    }
    result.next = result.next ? await getQuestion(result.next, 1, user_id, course_id, module_id) : null;
    result.previous = result.previous ? await getQuestion(result.previous, -1, user_id, course_id, module_id) : null;
    return result;
}

const getContentOrLesson = async (group, user_id, course_id, module_id) => {
    if(group.type === 'content'){
        const content = await getContent(group.content_id, user_id, course_id, module_id);

        if (!content.length) return { previous: null, next: null };

        const result = content[0];
        const resultData = await checkNullData(result, user_id, course_id, module_id);
        return resultData;
    } else if(group.type === 'lesson'){
        const lesson = await getLesson(group.lesson_id, user_id, course_id, module_id);

        if (!lesson.length) return { previous: null, next: null };

        const result = lesson[0];
        const resultData = await checkNullData(result, user_id, course_id, module_id);
        return resultData;
    } else {
        return { previous: null, next: null };
    }
}

const getPreviousNextCourse = async (id, type, user_id, course_id, module_id) => {
    if(type === 'content'){
        const content = await getContent(id, user_id, course_id, module_id);

        if (!content.length) return { previous: null, next: null };

        const result = content[0];
        const resultData = await checkNullData(result, user_id, course_id, module_id);
        return resultData;
    } else if(type === 'lesson'){
        const lesson = await getLesson(id, user_id, course_id, module_id);

        if (!lesson.length) return { previous: null, next: null };
        const result = lesson[0];
        const resultData = await checkNullData(result, user_id, course_id, module_id);
        return resultData;
    } else if(type === 'group'){
        const question = await Question.findById(id).lean();
        const group = await Group.findOne({ _id: question.group_id }).lean();
        const groups = await Group.find({ 
            type: group.type,
            content_id: group.content_id,
            lesson_id: group.lesson_id,
            is_data: true,
            active: true,
            deleted_at: null
        }).sort({ _id: 1 }).lean();

        const groupIds = groups.map(group => group._id);
        const questions = await Question.aggregate([
            {
                $match: {
                    group_id: { $in: groupIds },
                    active: true,
                    deleted_at: null
                }
            },
            {
                $sort: { group_id: 1, _id: 1 }
            },
            {
                $group: {
                    _id: null,
                    questions: { $push: "$$ROOT" }
                }
            },
            {
                $addFields: {
                    currentIndex: { 
                        $indexOfArray: ["$questions._id", question._id]
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    previous: {
                        $cond: {
                            if: { $gt: ["$currentIndex", 0] },
                            then: {
                                $arrayElemAt: ["$questions", { $subtract: ["$currentIndex", 1] }]
                            },
                            else: null
                        }
                    },
                    next: {
                        $cond: {
                            if: {
                                $lt: ["$currentIndex", { $subtract: [{ $size: "$questions" }, 1] }]
                            },
                            then: {
                                $arrayElemAt: ["$questions", { $add: ["$currentIndex", 1] }]
                            },
                            else: null
                        }
                    }
                }
            }
        ]);
        const result = questions[0] || { previous: null, next: null };
        let previous = null;
        let next = null;
        if(result.previous){
            const groupData = await Group.findById(result.previous.group_id)
                .populate('content_id')
                .populate('lesson_id')
                .lean();
            previous = result.previous ? {
                id: result.previous._id,
                type: 'group',
                self_evaluation: false,
                content_id: groupData.type === 'content' ? groupData.content_id._id : null,
                lesson_id: groupData.type === 'content' ? groupData.content_id.lesson_id : groupData.lesson_id._id
            } : null;
        }
        if(result.next){
            const groupData = await Group.findById(result.next.group_id)
                .populate('content_id')
                .populate('lesson_id')
                .lean();
            next = result.next ? {
                id: result.next._id,
                type: 'group',
                self_evaluation: false,
                content_id: groupData.type === 'content' ? groupData.content_id._id : null,
                lesson_id: groupData.type === 'content' ? groupData.content_id.lesson_id : groupData.lesson_id._id
            } : null;
        }
        if(!next || !previous){
            const contentOrLesson = await getContentOrLesson(group, user_id, course_id, module_id);
            next = !next ? contentOrLesson.next : next;
            previous = !previous ? contentOrLesson.previous : previous;
        }
        return { previous, next };
    } else {
        return { previous: null, next: null };
    }
}

const progressUpdate = async (data) => {
    const { id, user_id, course_id, module_id, type, self_evaluation } = data;
    const baseProgress = {
        total: 0,
        completed: 0,
        percentage: 0
    };

    const getProgressQuery = (type, id, self_evaluation) => {
        const query = {
            user_id,
            course_id,
            module_id,
            model: type === 'group' ? 'question' : type,
            self_evaluation
        };

        if (type === 'lesson') query.lesson_id = id;
        if (type === 'content') query.content_id = id;
        if (type === 'group') query.question_id = id;

        return query;
    };

    if(type === 'lesson'){
        const progress = await Progress.findOne(getProgressQuery(type, id));
        if(!progress){
            await Progress.create({
                user_id,
                course_id,
                module_id,
                lesson_id: id,
                model: 'lesson',
                type: 'upload',
                status: 'in_progress',
                progress: baseProgress,
                self_evaluation: self_evaluation,
                started_at: new Date()
            });
        }
    } else if(type === 'content'){
        const content = await Content.findById(id).lean();
        const lessonProgress = await Progress.findOne({
            user_id,
            course_id,
            module_id,
            lesson_id: content.lesson_id,
            model: 'lesson'
        });

        if(!lessonProgress){
            await Progress.create({
                user_id,
                course_id,
                module_id,
                lesson_id: content.lesson_id,
                model: 'lesson',
                type: 'content',
                status: 'in_progress',
                progress: baseProgress,
                self_evaluation: self_evaluation,
                started_at: new Date()
            });
        }

        const contentProgress = await Progress.findOne(getProgressQuery(type, id));
        if(!contentProgress){
            await Progress.create({
                user_id,
                course_id,
                module_id,
                lesson_id: content.lesson_id,
                content_id: id,
                model: 'content',
                type: content.type,
                status: 'in_progress',
                self_evaluation: self_evaluation,
                started_at: new Date()
            });
        }
    } else if(type === 'group'){
        const question = await Question.findById(id).lean();
        const group = await Group.findOne({ _id: question.group_id }).lean();

        if(group.type === 'lesson'){
            const lessonProgress = await Progress.findOne({
                user_id,
                course_id,
                module_id,
                lesson_id: group.lesson_id,
                model: 'lesson'
            });

            if(!lessonProgress){
                await Progress.create({
                    user_id,
                    course_id,
                    module_id,
                    lesson_id: group.lesson_id,
                    model: 'lesson',
                    type: 'question',
                    status: 'in_progress',
                    progress: baseProgress,
                    self_evaluation: self_evaluation,
                    started_at: new Date()
                });
            }
            const questionProgress = await Progress.findOne(getProgressQuery(type, id, self_evaluation));
            if(!questionProgress){
                await Progress.create({
                    user_id,
                    course_id,
                    module_id,
                    lesson_id: group.lesson_id,
                    group_id: group._id,
                    question_id: question._id,
                    model: 'question',
                    status: 'in_progress',
                    self_evaluation: self_evaluation,
                    started_at: new Date()
                });
            }
        } else if(group.type === 'content'){
            const content = await Content.findById(group.content_id).lean();
            const lessonProgress = await Progress.findOne({
                user_id,
                course_id,
                module_id,
                lesson_id: content.lesson_id,
                model: 'lesson'
            });

            if(!lessonProgress){
                await Progress.create({
                    user_id,
                    course_id,
                    module_id,
                    lesson_id: content.lesson_id,
                    model: 'lesson',
                    type: 'content',
                    status: 'in_progress',
                    progress: baseProgress,
                    self_evaluation: self_evaluation,
                    started_at: new Date()
                });
            }

            const contentProgress = await Progress.findOne({
                user_id,
                course_id,
                module_id,
                lesson_id: content.lesson_id,
                content_id: group.content_id,
                model: 'content'
            });

            if(!contentProgress){
                await Progress.create({
                    user_id,
                    course_id,
                    module_id,
                    lesson_id: content.lesson_id,
                    content_id: group.content_id,
                    model: 'content',
                    type: content.type,
                    status: 'in_progress',
                    self_evaluation: self_evaluation,
                    started_at: new Date()
                });
            }

            const questionProgress = await Progress.findOne(getProgressQuery(type, id, self_evaluation));
            if(!questionProgress){
                await Progress.create({
                    user_id,
                    course_id,
                    module_id,
                    lesson_id: content.lesson_id,
                    content_id: group.content_id,
                    group_id: group._id,
                    question_id: question._id,
                    model: 'question',
                    status: 'in_progress',
                    self_evaluation: self_evaluation,
                    started_at: new Date()
                });
            }
        }
    }
    return true;
}

const lessonProgressUpdate = async (data) => {
    const { id, course_id, module_id, type, self_evaluation, answer, user_id } = data;
    const progress = await Progress.findOne({
        user_id,
        course_id,
        module_id,
        lesson_id: id,
        model: 'lesson'
    });
    if(!progress){
        return {
            message: 'This lesson is not in progress',
            status: false
        };
    }
    if(progress.status === 'completed'){
        return {
            message: 'This lesson is already completed',
            status: false
        };
    }
    return await lessonsCompleted(progress);
}

const contentProgressUpdate = async (data) => {
    const { id, course_id, module_id, type, self_evaluation, answer, user_id } = data;
    const progress = await Progress.findOne({
        user_id,
        course_id,
        module_id,
        content_id: id,
        model: 'content'
    });
    if(!progress){
        return {
            message: 'This content is not in progress',
            status: false
        };
    }
    if(progress.status === 'completed'){
        return {
            message: 'This content is already completed',
            status: false
        };
    }
    const content = await Content.findById(id).lean();
    if(content.type === 'upload'){
        progress.content = content.content_data;
    }
    progress.status = 'completed';
    progress.completed_at = new Date();
    await progress.save();
    return await lessonsCompleted(progress);
}

const groupProgressUpdate = async (data) => {
    const { id, course_id, module_id, type, self_evaluation, answer, user_id } = data;
    const progress = await Progress.findOne({
        user_id,
        course_id,
        module_id,
        model: 'question',
        question_id: id
    });
    if(!progress){
        return {
            message: 'This question is not in progress',
            status: false
        };
    }
    if(progress.status === 'completed'){
        return {
            message: 'This question is already completed',
            status: false
        };
    }

    let isCorrect = null;
    const question = await Question.findById(id).lean();
    if(question.type === 'multi_choice'){
        isCorrect = question.correct_option === answer;
    }

    progress.question_type = question.type;
    progress.answer = answer;
    progress.is_correct = isCorrect;
    progress.status = 'completed';
    progress.question = question;
    progress.completed_at = new Date();
    progress.answered_at = new Date();
    await progress.save();

    const previousNextCourse = await getPreviousNextCourse(id, type, user_id, course_id, module_id);
    const modelType = progress.content_id ? 'content' : 'lesson';
    const completedUpdates = await progressCompleted(progress, previousNextCourse.next, modelType, data);
    return completedUpdates;
}

const progressCompleted = async (progress, next, modelType, data) => {
    if(next){
        if(modelType === 'lesson'){
            if(progress.lesson_id.toString() !== next.lesson_id.toString()){
                return await lessonsCompleted(progress);
            } else {
                return { status: true, message: 'Data process updated successfully' };
            }
        } else {
            let nextContent = next.content_id ? next.content_id.toString() : null;
            let progressContent = progress.content_id ? progress.content_id.toString() : null;
            if(nextContent !== progressContent){
                const contentProgress = await Progress.findOne({
                    user_id: progress.user_id,
                    course_id: progress.course_id,
                    module_id: progress.module_id,
                    content_id: progress.content_id,
                    model: 'content',
                    deleted_at: null,
                    active: true
                });
                contentProgress.status = 'completed';
                contentProgress.completed_at = new Date();
                await contentProgress.save();
                return await lessonsCompleted(contentProgress);
            } else {
                return { status: true, message: 'Data process updated successfully' };
            }
        }
    } else {
        if(modelType === 'lesson'){
            return await lessonsCompleted(progress);
        } else {
            const contentProgress = await Progress.findOne({
                user_id: progress.user_id,
                course_id: progress.course_id,
                module_id: progress.module_id,
                content_id: progress.content_id,
                model: 'content',
                deleted_at: null,
                active: true
            });
            contentProgress.status = 'completed';
            contentProgress.completed_at = new Date();
            await contentProgress.save();
            return await lessonsCompleted(contentProgress);
        }
    }
}

const lessonsCompleted = async (progress) => {
    const lesson = await Lesson.findById(progress.lesson_id).lean();
    const lessonProgress = await Progress.findOne({
        user_id: progress.user_id,
        course_id: progress.course_id,
        module_id: progress.module_id,
        lesson_id: progress.lesson_id,
        model: 'lesson'
    });
    if(lesson.type === 'question' || lesson.type === 'upload'){
        if(lesson.type === 'upload'){
            lessonProgress.content = lesson.content_data;
        }
       lessonProgress.status = 'completed';
       lessonProgress.completed_at = new Date();
       lessonProgress.progress.total = 1;
       lessonProgress.progress.completed = 1;
       lessonProgress.progress.percentage = 100;
       await lessonProgress.save();
       return await modulesCompleted(lessonProgress);
    } else {
        const contentCompletedDocs = await Progress.find({
            user_id: lessonProgress.user_id,
            course_id: lessonProgress.course_id,
            module_id: lessonProgress.module_id,
            lesson_id: lessonProgress.lesson_id,
            model: 'content',
            status: 'completed',
            deleted_at: null,
            active: true
        });
        const completedContentIds = contentCompletedDocs.map(doc => doc.content_id);
        const contentCount = await Content.find({ 
            lesson_id: lessonProgress.lesson_id,
            $or: [
                { active: true, deleted_at: null, is_data: true, type: { $ne: null } },
                { _id: { $in: completedContentIds } }
            ]
        }).countDocuments();
        const contentCompleted = contentCompletedDocs.length;
        const percentage = (contentCompleted / contentCount) * 100;
        let progressData = {
            total: contentCount,
            completed: contentCompleted,
            percentage: percentage
        };
        lessonProgress.progress = progressData;
        if(percentage === 100){
            lessonProgress.status = 'completed';
            lessonProgress.completed_at = new Date();
            await lessonProgress.save();
            return await modulesCompleted(lessonProgress);
        }
        await lessonProgress.save();
        return { status: true, message: 'Data process updated successfully' };
    }
}

const modulesCompleted = async (progress) => {
    const lessonCompletedDocs = await Progress.find({
        user_id: progress.user_id,
        course_id: progress.course_id,
        module_id: progress.module_id,
        model: 'lesson',
        status: 'completed',
        deleted_at: null,
        active: true
    });
    const completedLessonIds = lessonCompletedDocs.map(doc => doc.lesson_id);
    const lessonCount = await Lesson.find({ 
        module_id: progress.module_id,
        $or: [
            { active: true, deleted_at: null, is_data: true, type: { $ne: null } },
            { _id: { $in: completedLessonIds } }
        ]
    }).countDocuments();
    const lessonCompleted = lessonCompletedDocs.length;
    const percentage = (lessonCompleted / lessonCount) * 100;
    let progressData = {
        total: lessonCount,
        completed: lessonCompleted,
        percentage: percentage
    };
    const moduleProgress = await Progress.findOne({
        user_id: progress.user_id,
        course_id: progress.course_id,
        module_id: progress.module_id,
        model: 'module',
        deleted_at: null,
        active: true
    });
    moduleProgress.progress = progressData;
    if(percentage === 100){
        moduleProgress.status = 'completed';
        moduleProgress.completed_at = new Date();
        await moduleProgress.save();
        return await courseCompleted(moduleProgress);
    }
    await moduleProgress.save();
    return { status: true, message: 'Data process updated successfully' };
}

const courseCompleted = async (progress) => {
    const assignedCourse = await AssignedCourse.findOne({
        user_id: progress.user_id,
        course_id: progress.course_id,
        active: true,
        deleted_at: null
    });
    const course = await Course.findById(progress.course_id).lean();
    let scheduledModules = [];
    if(course.unlocking_type === 'scheduled'){
        scheduledModules = course.scheduled_unlocking.map(module => module.module_id);
    }
    const moduleCompletedDocs = await Progress.find({
        user_id: progress.user_id,
        course_id: progress.course_id,
        model: 'module',
        status: 'completed',
        deleted_at: null,
        active: true
    });
    const completedModuleIds = moduleCompletedDocs.map(doc => doc.module_id);
    const moduleCountDocs = await Module.aggregate([
        {
            $lookup: {
                from: 'lessons',
                let: { moduleId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$module_id', '$$moduleId'] },
                                    { $eq: ['$active', true] },
                                    { $eq: ['$deleted_at', null] },
                                    { $eq: ['$is_data', true] },
                                    { $ne: ['$type', null] }
                                ]
                            }
                        }
                    }
                ],
                as: 'lessons'
            }
        },
        {
            $match: {
                framework_id: course.framework,
                $or: [
                    { 
                        active: true, 
                        deleted_at: null, 
                        is_data: true,
                        $expr: { $gt: [{ $size: '$lessons' }, 0] },
                        ...(scheduledModules.length > 0 ? { _id: { $in: scheduledModules } } : {})
                    },
                    { _id: { $in: completedModuleIds } }
                ]
            }
        }
    ]);
    const moduleCompleted = moduleCompletedDocs.length;
    const moduleCount = moduleCountDocs.length;
    const percentage = (moduleCompleted / moduleCount) * 100;
    let progressData = {
        total: moduleCount,
        completed: moduleCompleted,
        percentage: percentage
    };
    assignedCourse.progress = progressData;
    if(percentage === 100){
        assignedCourse.status = 'completed';
        assignedCourse.completed_at = new Date();
    }
    await assignedCourse.save();
    return { status: true, message: 'Data process updated successfully' };
}

const getCompletedData = async (progress) => {
    const model = progress.model;
    switch(model){
        case 'lesson':
            return await getCompletedLesson(progress);
        case 'content':
            return await getCompletedContent(progress);
        case 'question':
            return await getCompletedQuestion(progress);
        default:
            return { status: false, message: `Invalid ${model} type` };
    }
}

const getCompletedLesson = async (progress) => {
   switch(progress.type){
    case 'question':
        return await getCompletedQuestion(progress);
    case 'upload':
        return getCompletedUploads(progress);
    case 'content':
        return await getCompletedLessonContent(progress);
    default:
        return { status: false, message: 'Invalid lesson type' };
   }
}

const getCompletedContent = async (progress) => {
    switch(progress.type){
        case 'question':
            return await getCompletedQuestion(progress);
        case 'upload':
            return getCompletedUploads(progress);
        default:
            return { status: false, message: 'Invalid content type' };
    }
}

const getCompletedUploads = async (progress) => {
    const previousNext = await getCompletedPreviousNext(progress);
    return {
        status: true,
        message: 'Data fetched successfully',
        data: {
            id: progress.model === 'content' ? progress.content_id : progress.lesson_id,
            content_data: progress.content,
            type: progress.model,
            previous: previousNext.previous,
            next: previousNext.next,
            active: {
                content_id: progress.content_id,
                lesson_id: progress.lesson_id
            },
            status: progress.status
        }
    }
}

const getCompletedLessonContent = async (progress) => {
    const content = await Progress.findOne({
        user_id: progress.user_id,
        course_id: progress.course_id,
        module_id: progress.module_id,
        lesson_id: progress.lesson_id,
        model: 'content',
        deleted_at: null,
        active: true
    }).sort({ _id: 1 }).lean();
    if(content){
        return await getCompletedContent(content);
    }
    return { status: false, message: 'No content in this lesson' };
}

const getCompletedQuestion = async (progress) => {
    let question = null;
    let questionIds = [];
    const getQuery = {
        user_id: progress.user_id,
        course_id: progress.course_id,
        module_id: progress.module_id,
        model: 'question',
        deleted_at: null,
        active: true
    }
    switch(progress.model){
        case 'lesson':
            const questionLessonData = await Progress.find({
                ...getQuery,
                lesson_id: progress.lesson_id
            }).sort({ _id: 1 }).lean();
            if(questionLessonData.length > 0){
                question = questionLessonData[0];
                questionIds = [
                    ...new Set(
                        questionLessonData.map(q => q.question_id.toString())
                    )
                ];
            }
            break;
        case 'content':
            const questionContentData = await Progress.find({
                ...getQuery,
                content_id: progress.content_id
            }).sort({ _id: 1 }).lean();
            if(questionContentData.length > 0){
                question = questionContentData[0];
                questionIds = [
                    ...new Set(
                      questionContentData.map(q => q.question_id.toString())
                    )
                ];
            }
            break;
        case 'question':
            question = progress;
            const questionData = await Progress.find({
                ...getQuery,
                lesson_id: progress.lesson_id,
                ...(progress.content_id ? { content_id: progress.content_id } : {})
            }).sort({ _id: 1 }).lean();
            if(questionData.length > 0){
                questionIds = [
                    ...new Set(
                        questionData.map(q => q.question_id.toString())
                    )
                ];
            }
            break;
        default:
            return { status: false, message: 'Invalid question type' };
    }
    if(!question){
        return { status: false, message: `No question in this ${progress.model}` };
    }
    const previousNext = await getCompletedPreviousNext(question);
    if(question.self_evaluation){
        return { 
            status: true,
            message: 'Data fetched successfully',
            data: {
                correct: question.self_evaluation_score.correct,
                wrong: question.self_evaluation_score.wrong,
                total: question.self_evaluation_score.total,
                previous: previousNext.previous,
                next: previousNext.next,
                active: {
                    content_id: question.content_id,
                    lesson_id: question.lesson_id
                },
                status: question.status
            }
        };
    }
    return { 
        status: true,
        message: 'Data fetched successfully',
        data: {
            question: question.question,
            answer: question.answer,
            id: question.question_id,
            questionIds: questionIds,
            type: 'group',
            previous: previousNext.previous,
            next: previousNext.next,
            active: {
                content_id: question.content_id,
                lesson_id: question.lesson_id
            },
            status: question.status
        }
    };
}

const getCompletedPreviousNext = async (progress) => {
    const allProgress = await Progress.find({
        user_id: progress.user_id,
        course_id: progress.course_id,
        module_id: progress.module_id,
        model: { $in: ['question', 'content', 'lesson'] },
        type: { $in: ['upload', null] },
        deleted_at: null,
        active: true
    }).sort({ _id: 1 }).lean();

    const currentIndex = allProgress.findIndex(p => p._id.toString() === progress._id.toString());
    
    let previous = null;
    let next = null;

    if (currentIndex > 0) {
        previous = allProgress[currentIndex - 1];
    }

    if (currentIndex < allProgress.length - 1) {
        next = allProgress[currentIndex + 1];
    }

    let result = {
        previous: previous ? {
            id: previous.question_id || previous.content_id || previous.lesson_id,
            type: previous.model === 'question' ? 'group' : previous.model,
            self_evaluation: previous.self_evaluation || false,
            content_id: previous.content_id,
            lesson_id: previous.lesson_id
        } : null,
        next: next ? {
            id: next.question_id || next.content_id || next.lesson_id,
            type: next.model === 'question' ? 'group' : next.model,
            self_evaluation: next.self_evaluation || false,
            content_id: next.content_id,
            lesson_id: next.lesson_id
        } : null
    };

    if(!result.next){
        const moduleProgress = await Progress.findOne({
            user_id: progress.user_id,
            course_id: progress.course_id,
            module_id: progress.module_id,
            model: 'module',
            deleted_at: null,
            active: true
        });
        if(moduleProgress.status !== 'completed'){
            let id = null;
            let type = progress.model === 'question' ? 'group' : progress.model;
            if(progress.model === 'lesson'){
                id = progress.lesson_id;
            } else if(progress.model === 'content'){
                id = progress.content_id;
            } else {
                id = progress.question_id;
            }
            const inprogressPreviouNext = await getPreviousNextCourse(id, type, progress.user_id, progress.course_id, progress.module_id);
            result.next = inprogressPreviouNext.next;
        }
    }
    return result;
}

 module.exports = {
    getQuestion,
    getPreviousNextCourse,
    getQuestionData,
    progressUpdate,
    groupProgressUpdate,
    lessonProgressUpdate,
    contentProgressUpdate,
    getCompletedData
 }