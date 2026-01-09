export enum UserCorpRelation {
    NOT_READY = 'NOT_READY', // no enterprises
    READY = 'READY', // next
    NEED_CHOOSE_ENTERPRISE = 'NEED_ENTERPRISE', // need choose enterprise 
    NEED_CHOOSE_ESTABLISHMENT = 'NEED_ESTABLISHMENT', // need choose establishment
    NEED_CHOOSE_ENTERPRISE_AND_ESTABLISHMENT = 'NEED_ENTERPRISE_AND_ESTABLISHMENT' // need choose enterprise and establishment
}