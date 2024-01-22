import QuickTagPlugin from "main"
import { KNOWN_BAD_CHARACTERS } from "./constants"


interface ModMap {
    [key: string]: null | Function
}

const modifier_map: ModMap = {
    'none': null,
    'camelcase': camelCase,
    'pascalcase': titleCase,
    'snakecase': snakeCase,
    'kebabcase': kebabCase
}


export function prep_clean_query(original_query: string, plugin: QuickTagPlugin){
    let fixed_query = original_query

    let setting_value: string = plugin.settings.preffered_casing
    let modifier_func = modifier_map[setting_value as string]

    if (modifier_func){
        fixed_query = modifier_func(fixed_query)
    }

    // previously used /[^\w\p{Emoji_Presentation]/gu regex, but apparently lots of weird unicode characters are valid tags
    for(const index in KNOWN_BAD_CHARACTERS){
        fixed_query = fixed_query.replaceAll(KNOWN_BAD_CHARACTERS[index], '')
    }

    // forward-slash characters are for tag hierarchy, they cannot be consecutive
    const slash_regex = /\/{2,}/gi
    fixed_query = fixed_query.replace(slash_regex, "/")

    return fixed_query
}


function titleCase(str: string){
    str = str.toLocaleLowerCase()
    let words = str.split(' ')
    for(let i=0; i < words.length; i++){
        words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1)
    }
    return words.join(' ')
}

function camelCase(str: string){
    str = str.toLocaleLowerCase()
    let words = str.split(' ')
    for(let i=0; i < words.length; i++){
        if(i == 0){
            continue
        }
        words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1)
    }
    return words.join(' ')
}

function kebabCase(str: string){
    str = str.replaceAll(' ', "-")
    while (str.contains('--')){
        str.replace('--', '-')
    }
    return str
}

function snakeCase(str: string){
    str = str.replaceAll(' ', "_")
    while (str.contains('__')){
        str.replace('__', '_')
    }
    return str
}