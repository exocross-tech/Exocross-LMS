const Organization = require('../models/organization');
const Module = require('../models/module');
const User = require('../models/user');
const Role = require('../models/role');
const AssignedCourse = require('../models/assignedCourse');
const Course = require('../models/course');
const Lesson = require('../models/lession');
const Content = require('../models/content');
const Question = require('../models/question');
const Group = require('../models/group');
const mongoose = require('mongoose');

const roleUpdate = async (user, newUser, user_type, organization) => {
    // await AssignedCourse.deleteMany({ user_id: user._id, deleted_at: null });
    // return true;
    let typeUpdate = 0;
    if(user_type !== user.user_type){
        await unassignCourseIndividual(user);
        user.user_type = user_type;
        user.organization = organization;
        typeUpdate++;
    }
    
    const roles = await Role.find({deleted_at: null}).select('_id slug').lean();
    const roleMap = new Map(roles.map(role => [role._id.toString(), role.slug]));
    
    const userRole = user.roles.map(role => roleMap.get(role.toString()));
    const newRole = newUser.roles.map(role => roleMap.get(role.toString()));
    
    const add = newRole.filter(role => !userRole.includes(role) && ['facilitator', 'learner'].includes(role));
    const remove = userRole.filter(role => !newRole.includes(role) && ['facilitator', 'learner'].includes(role));
    
    if(remove.length > 0){
        if(remove.includes('facilitator')){
            const result = await unassignCourseFacilitator(user);
            if(!result){
                return {
                    status: false,
                    message: 'Facilitator is assigned to courses. Please unassign the facilitator from the courses first.'
                };
            }
        }
        if(remove.includes('learner')){
            await unassignCourseIndividual(user);
        }
    }
    
    let addCount = 0;
    if(add.length > 0){
        if(add.includes('learner')){
            await assignCourseIndividual(user);
            addCount++;
        }
    }

    if(addCount === 0 && typeUpdate !== 0){
        await assignCourseIndividual(user);
    }

    return {status: true, message: 'Successfully updated roles'};
}

const unassignCourseFacilitator = async (user) => {
    const courses = await Course.find({
        facilitators: { $in: [user._id] },
        active: true,
        deleted_at: null
    }).select('_id name facilitators').lean();
    
    const coursesWithSingleFacilitator = courses.filter(course => 
        course.facilitators.length <= 1
    );

    if(coursesWithSingleFacilitator.length > 0){
        return false;
    }

    await Course.updateMany(
        {
            facilitators: { $in: [user._id] },
            active: true,
            deleted_at: null
        },
        { 
            $pull: { 
                facilitators: user._id 
            }
        }
    );
    
    return true;
}

const assignCourseIndividual = async (user) => {
    const courses = await Course.find({
        organizations: {
            $elemMatch: {
                is_organization: user.user_type === 'organization',
                organization_id: user.user_type === 'organization' ? user.organization : null
            }
        },
        active: true, 
        deleted_at: null
    }).select('_id name organizations').lean();
    
    const courseIds = courses.map(course => course._id);
    const existingAssignedCourses = await AssignedCourse.find({
        user_id: user._id,
        course_id: { $in: courseIds },
        active: false,
        deleted_at: null
    }).select('_id course_id').lean();
    
    const existingCourseIds = existingAssignedCourses.map(course => course.course_id.toString());
    await AssignedCourse.updateMany(
        {
            _id: { $in: existingAssignedCourses.map(course => course._id) },
        },
        { $set: { active: true } }
    );
    await Course.updateMany(
        {
            _id: { $in: existingAssignedCourses.map(course => course.course_id) },
            organizations: {
                $elemMatch: {
                    is_organization: user.user_type === 'organization',
                    organization_id: user.user_type === 'organization' ? user.organization : null,
                    type: 'separate'
                }
            },
            deleted_at: null,
            active: true
        },
        { 
            $push: { 
                "organizations.$[].users": user._id 
            } 
        }
    );

    const allCourses = await Course.find({
        organizations: {
            $elemMatch: {
                is_organization: user.user_type === 'organization',
                organization_id: user.user_type === 'organization' ? user.organization : null,
                type: 'all'
            }
        },
        active: true, 
        deleted_at: null
    }).select('_id name organizations').lean();
    const allCourseIds = allCourses.map(course => course._id);

    const newCourseIds = allCourseIds.filter(id => !existingCourseIds.includes(id.toString()));

    if (newCourseIds.length > 0) {
        const newAssignments = newCourseIds.map(courseId => ({
            course_id: courseId,
            user_id: user._id,
            active: true,
            status: 'not_started',
            assigned_at: new Date()
        }));
        await AssignedCourse.insertMany(newAssignments);
    }
    
    return true;
}

const unassignCourseIndividual = async (user) => {
    const assignedCourses = await AssignedCourse.find({
        user_id: user._id,
        deleted_at: null,
        active: true
    }).select('_id course_id').lean();
    const assignedCourseIds = assignedCourses.map(course => course.course_id);

    const course = await Course.find({
        _id: { $in: assignedCourseIds },
        organizations: {
            $elemMatch: {
                is_organization: user.user_type === 'organization',
                organization_id: user.user_type === 'organization' ? user.organization : null,
                type: 'separate'
            }
        },
        deleted_at: null,
        active: true
    }).select('_id name organizations').lean();
    const courseIds = course.map(course => course._id);
    
    if(course.length > 0){
        await Course.updateMany(
            { 
                _id: { $in: courseIds },
                organizations: {
                    $elemMatch: {
                        is_organization: user.user_type === 'organization',
                        organization_id: user.user_type === 'organization' ? user.organization : null,
                        type: 'separate'
                    }
                }
            },
            { 
                $pull: { 
                    "organizations.$[].users": user._id
                }
            }
        );
    }
    await AssignedCourse.updateMany(
        { user_id: user._id, deleted_at: null },
        { $set: { active: false } }
    );
    return true;
}

const processOrganizations = async (organizations) => {
    if (!organizations || !organizations.length) return [];
    
    const organizationIds = organizations
        .filter(org => org.is_organization && org.organization_id)
        .map(org => org.organization_id);
        
    if (!organizationIds.length) {
        return organizations.map(org => ({
            _id: 'individuals',
            name: 'Individuals'
        }));
    }
        
    const orgDocs = await Organization.find({ 
        _id: { $in: organizationIds },
        deleted_at: null 
    }).select('_id name').lean();
    
    const orgMap = new Map(orgDocs.map(org => [org._id.toString(), org.name]));
    
    return organizations.map(org => {
        if (org.is_organization && org.organization_id) {
            return {
                _id: org.organization_id,
                name: orgMap.get(org.organization_id.toString()) || 'Unknown'
            };
        } else {
            return {
                _id: 'individuals',
                name: 'Individuals'
            };
        }
    });
};

const processScheduledUnlocking = async (scheduledUnlocking, framework_id) => {
    
    const modules = await Module.find({ 
        framework_id: framework_id,
        deleted_at: null,
        active: true
    }).select('name').sort({ display_order: 1 }).lean();

    const dateMap = new Map(
        scheduledUnlocking.map(item => [
            item.module_id.toString(),
            new Date(item.date).toISOString().split('T')[0]
        ])
    );

    const modulesWithDates = modules.map(module => ({
        module_name: module.name,
        module_id: module._id,
        date: dateMap.get(module._id.toString()) || null
    }));

    return modulesWithDates;
};

const processLearners = async (course_id, page = 1, limit = 10, search = '') => {
    const assignedCourses = await AssignedCourse.find({ course_id, deleted_at: null, active: true }).select('_id user_id').lean();
    const userIds = assignedCourses.map(course => course.user_id);
    const baseQuery = {
        _id: { $in: userIds },
        deleted_at: null
    };
    if (search) {
        baseQuery.$or = [
            { name: { $regex: search, $options: 'i' } }
        ];
    }

    const skip = (page - 1) * limit;
    
    const [users, totalRecords] = await Promise.all([
        User.find(baseQuery)
            .select('_id name')
            .skip(skip)
            .limit(limit)
            .sort({ _id: -1 })
            .lean(),
        User.countDocuments(baseQuery)
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    return {
        list: users.map((item, index) => ({
            ...item,
            serial_number: skip + index + 1
        })),
        current_page: page,
        total_pages: totalPages,
        total_records: totalRecords
    };
};

const processLearnersIds = async (organizations) => {
    const role = await Role.findOne({ slug: 'learner' });
    if (!role) {
        return [];
    }

    const baseQuery = {
        roles: role._id,
        deleted_at: null
    };

    let userQueries = [];
    
    if (organizations && organizations.length > 0) {
        const individualOrgs = organizations.filter(org => !org.is_organization);
        
        if (individualOrgs.length > 0) {
            const hasIndividualAllType = individualOrgs.some(org => org.type === 'all');
            
            if (hasIndividualAllType) {
                userQueries.push({
                    ...baseQuery,
                    user_type: 'individual'
                });
            } else {
                const individualUserIds = [];
                for (const org of individualOrgs) {
                    if (org.users && Array.isArray(org.users)) {
                        individualUserIds.push(...org.users);
                    }
                }
                
                if (individualUserIds.length > 0) {
                    userQueries.push({
                        ...baseQuery,
                        _id: { $in: individualUserIds },
                        user_type: 'individual'
                    });
                }
            }
        }
        
        const orgOrgs = organizations.filter(org => org.is_organization && org.organization_id);
            
        if (orgOrgs.length > 0) {
            // Process each organization separately based on its type
            for (const org of orgOrgs) {
                if (org.type === 'all') {
                    // For "all" type, include all users from this organization
                    userQueries.push({
                        ...baseQuery,
                        'organization': org.organization_id
                    });
                } else if (org.type === 'separate' && org.users && org.users.length > 0) {
                    // For "separate" type, only include specific users
                    userQueries.push({
                        ...baseQuery,
                        _id: { $in: org.users }
                    });
                }
            }
        }
    }
    
    if (userQueries.length === 0) {
        return [];
    }

    const query = userQueries.length > 1 ? { $or: userQueries } : userQueries[0];
    
    const users = await User.find(query)
        .select('_id name')
        .sort({ _id: -1 })
        .lean();

    return users.map(user => user._id);
};

const unassignCourse = async (userIds, unassign_type, organization = null) => {
    await AssignedCourse.updateMany(
        { user_id: { $in: userIds }, deleted_at: null },
        { $set: { active: false } }
    );
    if(unassign_type === 'organization'){
        await Course.updateMany(
            { "organizations.organization_id": organization },
            { 
                $pull: { 
                    organizations: { 
                        organization_id: organization
                    } 
                } 
            }
        );
    } else if(unassign_type === 'user'){
        await Course.updateMany(
            { "organizations.users": { $in: userIds } },
            { 
                $pull: { 
                    "organizations.$[].users": { 
                        $in: userIds 
                    } 
                } 
            }
        );
    }
    return true;
};

const assignCourse = async (user) => {
    const { _id: userId, organization: organizationId, user_type } = user;

    const organizationMatch = user_type === 'individual' 
        ? { is_organization: false }
        : { is_organization: true, organization_id: organizationId };

    const courses = await Course.find({
        organizations: { 
            $elemMatch: { 
                ...organizationMatch,
                type: 'all'
            }
        },
        active: true,
        deleted_at: null
    })
    .select('_id')
    .sort({ _id: -1 })
    .lean();

    if (courses.length === 0) return true;

    const assignedCoursesData = courses.map(course => ({
        course_id: course._id,
        user_id: userId,
        active: true
    }));

    await AssignedCourse.insertMany(assignedCoursesData, { ordered: false });

    return true;
}

const roleAssignCourse = async (user) => {
    const courses = await AssignedCourse.find({ 
        user_id: user._id, 
        deleted_at: null, 
        active: false 
    }).select('_id course_id').lean();
    const assignedCourseIds = courses.map(course => course._id);
    await AssignedCourse.updateMany(
        { _id: { $in: assignedCourseIds } },
        { $set: { active: true } }
    );
    const courseIds = courses.map(course => course.course_id);
    const organizationMatch = user.user_type === 'individual' 
        ? { is_organization: false, _id: { $in: courseIds } }
        : { is_organization: true, organization_id: user.organization, _id: { $in: courseIds } };

    await Course.updateMany(
        { 
            organizations: { 
                $elemMatch: { 
                    ...organizationMatch,
                    type: 'separate'
                }
            }
        },
        { 
            $push: { 
                "organizations.$[].users": user._id 
            } 
        }
    );
    return true;
}

const getPreviousNextCourse = async (id, type) => {
    if(type === 'content'){
        const content = await getContent(id);

        if (!content.length) return { previous: null, next: null };

        const result = content[0];
        const resultData = await checkNullData(result);
        return resultData;
    } else if(type === 'lesson'){
        const lesson = await getLesson(id);

        if (!lesson.length) return { previous: null, next: null };
        const result = lesson[0];
        const resultData = await checkNullData(result);
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
            previous = result.previous ? {
                id: result.previous._id,
                type: 'group'
            } : null;
        }
        if(result.next){
            next = result.next ? {
                id: result.next._id,
                type: 'group'
            } : null;
        }
        if(!next || !previous){
            const contentOrLesson = await getContentOrLesson(group);
            next = !next ? contentOrLesson.next : next;
            previous = !previous ? contentOrLesson.previous : previous;
        }
        return { previous, next };
    } else {
        return { previous: null, next: null };
    }
}

const getContentOrLesson = async (group) => {
    if(group.type === 'content'){
        const content = await getContent(group.content_id);

        if (!content.length) return { previous: null, next: null };

        const result = content[0];
        const resultData = await checkNullData(result);
        return resultData;
    } else if(group.type === 'lesson'){
        const lesson = await getLesson(group.lesson_id);

        if (!lesson.length) return { previous: null, next: null };

        const result = lesson[0];
        const resultData = await checkNullData(result);
        return resultData;
    } else {
        return { previous: null, next: null };
    }
}

const checkNullData = async (result) => {
    if (!result.previous || !result.previous.id) {
        result.previous = null;
    }
    if (!result.next || !result.next.id) {
        result.next = null;
    }
    result.next = result.next ? await getQuestion(result.next, 1) : null;
    result.previous = result.previous ? await getQuestion(result.previous, -1) : null;
    return result;
}

const getContent = async (id) => {
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
                                    { $eq: ['$lesson_id', '$$lessonId'] },
                                    { $ne: ['$type', null] },
                                    { $eq: ['$active', true] },
                                    { $eq: ['$is_data', true] },
                                    { $eq: ['$deleted_at', null] }
                                ]
                            }
                        }
                    },
                    {
                        $sort: { display_order: 1 }
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
                                    { $eq: ['$module_id', '$$moduleId'] },
                                    { $ne: ['$type', null] },
                                    { $eq: ['$active', true] },
                                    { $eq: ['$is_data', true] },
                                    { $eq: ['$deleted_at', null] }
                                ]
                            }
                        }
                    },
                    {
                        $sort: { display_order: 1 }
                    }
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
                                cond: { $gt: ['$$lesson.display_order', '$currentLesson.display_order'] }
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
                                cond: { $lt: ['$$lesson.display_order', '$currentLesson.display_order'] }
                            }
                        },
                        -1  // Get the last element (closest to current)
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

const getLesson = async (id) => {
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
                                    { $eq: ['$module_id', '$$moduleId'] },
                                    { $eq: ['$active', true] },
                                    { $eq: ['$deleted_at', null] },
                                    { $eq: ['$is_data', true] },
                                    { $ne: ['$type', null] }
                                ]
                            }
                        }
                    },
                    {
                        $sort: { display_order: 1 }
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

const getQuestion = async (data, sort = 1) => {
   const { id, type, o_type, name } = data;
   if(o_type === 'question'){
    const question = await getQuestionData(id, type, sort);
    return question ? { id: question._id, type: 'group'} : { id: null, type: 'group'};
   } else if(type === 'lesson' && o_type === 'content'){
    const content = await Content.findOne({ lesson_id: id, is_data: true, active: true, deleted_at: null, type: { $ne: null } })
        .select('_id name type')
        .sort({ _id: sort })
        .lean();
    if(content.type === 'question'){
        const question = await getQuestionData(content._id, 'content', sort);
        return question ? { id: question._id, type: 'group'} : { id: null, type: 'group'};
    }
    return { id: content._id, type: 'content'};
   }
   return { id, type };
}

const getQuestionData = async (id, type, sort) => {
    const groupData = await Group.find({ [`${type}_id`]: id, active: true, is_data: true, deleted_at: null })
        .select('_id name')
        .sort({ _id: sort })
        .lean();
    const groupIds = groupData.map(group => group._id);
    const question = await Question.findOne({ group_id: { $in: groupIds }, active: true, deleted_at: null })
        .select('_id question')
        .sort({ group_id: sort, _id: sort })
        .lean();
    return question;
}

module.exports = {
    processOrganizations,
    processScheduledUnlocking,
    processLearners,
    processLearnersIds,
    unassignCourse,
    assignCourse,
    roleAssignCourse,
    getPreviousNextCourse,
    getQuestion,
    roleUpdate,
    unassignCourseFacilitator,
    unassignCourseIndividual
};