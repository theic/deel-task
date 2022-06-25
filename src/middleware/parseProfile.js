const parseProfile = async (req, res, next) => {
  req.profile.ClientId =
    req.profile.type === 'client'
    && req.profile.id;

  req.profile.ContractorId =
    req.profile.type === 'contractor'
    && req.profile.id;

  next();
}

export { parseProfile };
