const axios = require('axios');
const OtpHistory = require('../models/otpHistory');
const { SIDE_BAR } = require('../config/constant');
const { REDIRECT_URL } = require('../config/constant');

const sidebarData = async (role) => {
    const privileges = role.privileges;
    const sidebarData = [];
    const eLearningJourney = { ...SIDE_BAR['e-learning-journey'] };
    const eLearning = { ...SIDE_BAR['e-learning'] };

    privileges.forEach(privilege => {
        const sidebarItem = SIDE_BAR[privilege.slug];

        if (!sidebarItem) return;

        if (['e-learning-framework', 'add-and-assign-courses'].includes(privilege.slug)) {
            if (!sidebarData.find(item => item.slug === 'e-learning-journey')) {
                eLearningJourney.child = [];
                sidebarData.push(eLearningJourney);
            }

            if (!eLearningJourney.child.find(child => child.slug === privilege.slug)) {
                eLearningJourney.child.push(sidebarItem);
            }
        } else if (['view-assigned-courses', 'view-courses-progress', 'discussion-forum'].includes(privilege.slug)) {
            if (!sidebarData.find(item => item.slug === 'e-learning')) {
                eLearning.child = [];
                sidebarData.push(eLearning);
            }

            if (!eLearning.child.find(child => child.slug === privilege.slug)) {
                eLearning.child.push(sidebarItem);
            }
        } else if (role.slug === 'learner' && privilege.slug === 'dashboard') {
            sidebarItem.slug = 'learners';
            sidebarData.push(sidebarItem);
        } else if (role.slug === 'facilitator' && privilege.slug === 'dashboard') {
            sidebarItem.slug = 'facilitator';
            sidebarData.push(sidebarItem);
        } else if (role.slug === 'super-admin' && privilege.slug === 'dashboard') {
            sidebarItem.slug = 'dashboard';
            sidebarData.push(sidebarItem);
        } else {
            sidebarData.push(sidebarItem);
        }
    });

    return sidebarData;
};

const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

const sendOtp = async (phone, otp, type, user_id) => {
    const response = await axios.post(
        process.env.MSG91_API,
        {
          template_id: process.env.MSG91_TEMPLATE_ID,
          sender: process.env.MSG91_SENDER,
          short_url: '0',
          mobiles: `91${phone}`,
          var: otp
        },
        {
          headers: {
            Authkey: process.env.MSG91_AUTHKEY,
            accept: 'application/json',
            'content-type': 'application/json'
          }
        }
    );
    await OtpHistory.create({
        user_id: user_id,
        phone: phone,
        otp: otp,
        type: type,
        response: response.data
    });
    return response;
};

const getRedirectUrl = (roleSlug, privilegeSlug) => {
    if (roleSlug === 'facilitator' && privilegeSlug === 'dashboard') {
        return '/facilitator';
    }
    if (roleSlug === 'learner' && privilegeSlug === 'dashboard') {
        return '/learners';
    }
    return REDIRECT_URL[privilegeSlug];
};

module.exports = { 
    sidebarData,
    generateOTP,
    getRedirectUrl,
    sendOtp
};