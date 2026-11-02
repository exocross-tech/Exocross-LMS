const Role = require("../models/role");
const User = require("../models/user");
const { sendSuccess, sendError } = require("../utils/responseHandler");
const { hashPassword } = require("../utils/passwordUtils");
const { createSchema, updateSchema, filterSchema } = require("../validators/userValidator");
const mongoose = require('mongoose');
const courseService = require('../services/courseService');

const insertSuperAdmin = async (req, res) => {
  const superAdminRole = await Role.findOne({ slug: "super-admin" });
  if (!superAdminRole) throw new Error("Super Admin role not found");
  const hashedPassword = await hashPassword("12345");
  const user = {
    name: "Super Admin",
    email: "super-admin@gmail.com",
    phone: "9876543210",
    password: hashedPassword,
    user_type: "individual",
    roles: [superAdminRole._id],
    primary_role: superAdminRole._id,
    organization: null,
    other_info: null,
    is_verified: true,
  };
  const superAdmin = new User(user);
  await superAdmin.save();
  sendSuccess(res, "Super Admin inserted successfully", 200);
};

const create = async (req, res) => {
  const { error } = createSchema.validate(req.body);
  if (error) {
    return sendError(res, error.details[0].message, 400);
  }

  const mobileValidation = await User.findOne({ phone: req.body.phone, deleted_at: null });
  if (mobileValidation) {
    return sendError(res, "Phone number is already registered", 400);
  }
  if(req.body.email){
    const emailValidation = await User.findOne({ email: req.body.email, deleted_at: null });
    if (emailValidation) {
      return sendError(res, "Email is already registered", 400);
    }
  }
  const roles = await Role.findOne({ _id: { $in: req.body.roles } }).sort({ priority: 1 });
  if (!roles) {
    return sendError(res, "Roles not found", 400);
  }
  req.body.primary_role = roles._id;
  const user = await User.create(req.body);
  const learner = await Role.findOne({ slug: "learner" });
  if(user.roles.includes(learner._id)){
    await courseService.assignCourse(user);  
  } 
  sendSuccess(res, "User created successfully", 200);
};

const view = async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id)
    .select("-deleted_at -password -primary_role -otp")
    .populate("roles", "name slug")
    .populate("organization")
    .lean();

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  sendSuccess(res, "User details fetched successfully", 200, user);
};

const list = async (req, res) => {
  const { search, role, page = 1, limit = 10 } = req.body;
  const user = req.user;
  const pipeline = [
    {
      $lookup: {
        from: "organizations",
        localField: "organization",
        foreignField: "_id",
        as: "organizationData"
      }
    },
    {
      $lookup: {
        from: "roles",
        localField: "roles",
        foreignField: "_id",
        as: "rolesData"
      }
    },
    {
      $unwind: {
        path: "$organizationData",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $addFields: {
        organization_name: {
          $ifNull: ["$organizationData.name", "N/A"]
        },
      }
    },
    {
      $match: {
        deleted_at: null,
        ...(role && role !== '' ? { roles: new mongoose.Types.ObjectId(role) } : {}),
        ...(search
          ? {
              $or: [
                { name: { $regex: search || '', $options: "i" } },
                { phone: { $regex: search || '', $options: "i" } },
                // { "organizationData.name": { $regex: search, $options: "i" } },
                { "rolesData.name": { $regex: search || '', $options: "i" } },
                { organization_name: { $regex: search || '', $options: "i" } }
              ],
            }
          : {})
      }
    },
    {
      $sort: { _id: -1 }
    },
    {
      $skip: (page - 1) * Number(limit)
    },
    {
      $limit: Number(limit)
    },
    {
      $project: {
        name: 1,
        email: 1,
        phone: 1,
        user_type: 1,
        is_verified: 1,
        organization: {
          $ifNull: ["$organizationData", ""]
        },
        roles: {
          $map: {
            input: "$rolesData",
            as: "role",
            in: {
              _id: "$$role._id",
              name: "$$role.name",
              slug: "$$role.slug"
            }
          }
        }
      }
    }
  ];

  const countPipeline = [...pipeline];
  countPipeline.splice(-3); 
  countPipeline.push({ $count: "total" });

  const [users, [countResult]] = await Promise.all([
    User.aggregate(pipeline),
    User.aggregate(countPipeline)
  ]);

  const total = countResult ? countResult.total : 0;
  const totalPages = Math.ceil(total / limit);
  const subAdminRole = await Role.find({ slug: { $in: ['sub-admin', 'super-admin'] }, deleted_at: null });
  const subAdminRoleIds = subAdminRole.map(item => item._id.toString());
  sendSuccess(res, "User list fetched successfully", 200, {
    list: users.map((item, index) => {
      const hasSubAdminRole = item.roles.some(role => subAdminRoleIds.includes(role._id.toString()));
      return {
        ...item,
        is_action: user.current_role.slug === 'sub-admin' ? !hasSubAdminRole : true,
        serial_number: (page - 1) * limit + index + 1
      }
    }),
    current_page: Number(page),
    total_pages: totalPages,
    total_records: total,
  });
};

const update = async (req, res) => {
  const { id } = req.params;

  const { error } = updateSchema.validate(req.body);
  if (error) {
    return sendError(res, error.details[0].message, 400);
  }

  const user = await User.findById(id);
  if(!user){
    return sendError(res, "User not found", 404);
  }

  const mobileValidation = await User.findOne({ phone: req.body.phone, deleted_at: null, _id: { $ne: id } });
  if (mobileValidation) {
    return sendError(res, "Phone number is already registered", 400);
  }

  if(req.body.email){
    const emailValidation = await User.findOne({ email: req.body.email, deleted_at: null, _id: { $ne: id } });
    if (emailValidation) {
      return sendError(res, "Email is already registered", 400);
    }
  }

  const roles = await Role.findOne({ _id: { $in: req.body.roles } }).sort({ priority: 1 });
  if (!roles) {
    return sendError(res, "Roles not found", 400);
  }
  req.body.primary_role = roles._id;

  const roleUpdate = await courseService.roleUpdate(user, req.body, req.body.user_type, req.body.organization);
  
  if(!roleUpdate.status){
    return sendError(res, roleUpdate.message, 400);
  }

  const updatedUser = await User.findByIdAndUpdate(
    id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).lean();

  if (!updatedUser) {
    return sendError(res, "User not found", 404);
  }

  sendSuccess(res, "User updated successfully", 200);
};

const remove = async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    return sendError(res, "User not found", 404);
  }
  const facilitatorCheck = await courseService.unassignCourseFacilitator(user);
  if(!facilitatorCheck){
    return sendError(res, "Facilitator is assigned to courses. Please unassign the facilitator from the courses first.", 400);
  }
  await courseService.unassignCourseIndividual(user);
  await User.findByIdAndUpdate(id, { deleted_at: new Date() });
  sendSuccess(res, "User deleted successfully", 200);
};

const orgAndRoleBasedList = async (req, res) => {
  const { error } = filterSchema.validate(req.body);
  if (error) {
    return sendError(res, error.details[0].message, 400);
  }
  const { search, slug, organization, page = 1, limit = 10 } = req.body;
  const role = await Role.findOne({ slug: slug });
  const filter = {
      roles: { $in: [new mongoose.Types.ObjectId(role._id)] },
      organization: new mongoose.Types.ObjectId(organization),
      deleted_at: null
  };
  const skip = (page - 1) * limit;

  const pipeline = [
    { $match: filter },
    {
      $lookup: {
        from: 'assignedcourses',
        let: { userId: '$_id' },
        pipeline: [
          { 
            $match: {
              $expr: { $eq: ['$user_id', '$$userId'] },
              active: true,
              deleted_at: null
            }
          },
          {
            $lookup: {
              from: 'courses',
              localField: 'course_id',
              foreignField: '_id',
              as: 'course'
            }
          },
          {
            $unwind: '$course'
          },
          {
            $project: {
              _id: '$course._id',
              name: '$course.name'
            }
          }
        ],
        as: 'assigned_courses'
      }
    },
    {
      $match: {
        $or: [
          { name: { $regex: search || '', $options: 'i' } },
          { 'assigned_courses.name': { $regex: search || '', $options: 'i' } },
        ]
      }
    },
    { $sort: { _id: -1 } },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skip },
          { $limit: Number(limit) },
          {
            $project: {
              name: 1,
              courses: '$assigned_courses'
            }
          }
        ]
      }
    }
  ];

  const [result] = await User.aggregate(pipeline);
  const total = result.metadata[0]?.total || 0;
  const totalPages = Math.ceil(total / limit);

  sendSuccess(res, "User list fetched successfully", 200, {
    list: result.data.map((item, index) => ({
      ...item,
      serial_number: skip + index + 1
    })),
    current_page: Number(page),
    total_pages: totalPages,
    total_records: total,
  });
};

module.exports = {
  insertSuperAdmin,
  create,
  view,
  list,
  update,
  remove,
  orgAndRoleBasedList
};
