const DEFAULT_API_ORIGIN='https://app.75hard.club';
function apiOrigin(value=DEFAULT_API_ORIGIN){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('FINANCEMED_API_ORIGIN deve ser uma origem HTTPS, sem caminho, senha ou parâmetros.');
 return url.origin;
}
module.exports={apiOrigin,DEFAULT_API_ORIGIN};
