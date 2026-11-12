function canManageConsultations(user) {
    return user?.role === 'platform_owner' ||
        (user?.role === 'developer_admin' && user.email?.toLowerCase() === 'jemelia.peart@gmail.com');
}

module.exports = { canManageConsultations };
