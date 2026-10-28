const denied=()=>Response.json({detail:'Rota não encontrada.'},{status:404,headers:{'Cache-Control':'no-store'}});
export {denied as GET,denied as POST,denied as PUT,denied as PATCH,denied as DELETE,denied as HEAD,denied as OPTIONS};
