import Bids from '../bids/page';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{organizationId?:string;candidateId?:string}>}){return Bids({searchParams:Promise.resolve({...await searchParams,view:'interviews'})});}
