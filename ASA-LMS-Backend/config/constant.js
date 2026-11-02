const SIDE_BAR = {
    dashboard: {
        name: 'Dashboard',
        slug: 'dashboard',
        icon: '',
        is_child: false,
        child: []
    },
    organization: {
        name: 'Organization',
        slug: 'organization',
        icon: '',
        is_child: true,
        child: [
            {
                name: 'Add Organization',
                slug: 'add-organization',
                icon: ''
            },
            {
                name: 'Organization Listing',
                slug: 'organization-listing',
                icon: ''
            }
        ]
    },
    role: {
        name: 'Role',
        slug: 'role',
        icon: '',
        is_child: true,
        child: [
            {
                name: 'Role Listing',
                slug: 'role-listing',
                icon: ''
            }
        ]
    },
    users: {
        name: 'User',
        slug: 'users',
        icon: '',
        is_child: true,
        child: [
            {
                name: 'Add User',
                slug: 'add-user',
                icon: ''
            },
            {
                name: 'User Listing',
                slug: 'user-listing',
                icon: ''
            }
        ]
    },
    'e-learning-journey': {
        name: 'E-Learning Journey',
        slug: 'e-learning-journey',
        icon: '',
        is_child: true,
        child: []
    },
    'e-learning-framework': {
        name: 'E-Learning Framework',
        slug: 'e-learning-framework',
        icon: ''
    },
    'add-and-assign-courses': {
        name: 'Add and Assign Courses',
        slug: 'add-and-assign-courses',
        icon: ''
    },
    'e-learning': {
        name: 'E-Learning',
        slug: 'e-learning',
        icon: '',
        is_child: true,
        child: []
    },
    'view-assigned-courses': {
        name: 'View Courses',
        slug: 'view-assigned-courses',
        icon: ''
    },
    'view-courses-progress': {
        name: 'View Courses Progress',
        slug: 'view-courses-progress',
        icon: ''
    },
    'discussion-forum': {
        name: 'Discussion Forum',
        slug: 'discussion-forum',
        icon: ''
    }
};

const REDIRECT_URL = {
    dashboard: '/dashboard',
    organization: '/dashboard/organization/organization-listing',
    role: '/dashboard/role/role-listing',
    users: '/dashboard/users/user-listing',
    'e-learning-framework': '/dashboard/e-learning-journey/e-learning-framework/',
    'add-and-assign-courses': '/dashboard/e-learning-journey/add-and-assign-courses',
    'view-assigned-courses': '/dashboard/e-learning/view-assigned-courses',
    'view-courses-progress': '/dashboard/e-learning/view-courses-progress',
    'discussion-forum': '/dashboard/e-learning/discussion-forum'
};

const QUESTION_TYPE = [
    {
        name: 'Text Input',
        value: 'text_input'
    },
    {
        name: 'Likert Scale',
        value: 'likert_scale'
    },
    {
        name: 'Multi Choice',
        value: 'multi_choice'
    }
];

const UNLOCKING_TYPE = [
    {
        name: 'Sequential Unlocking',
        value: 'sequential'
    },
    {
        name: 'Scheduled Unlocking',
        value: 'scheduled'
    },
    {
        name: 'Unlock all modules',
        value: 'unlock_all'
    }
];

module.exports = {
    SIDE_BAR,
    REDIRECT_URL,
    QUESTION_TYPE,
    UNLOCKING_TYPE
};