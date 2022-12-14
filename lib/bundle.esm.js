import { Command } from 'commander';
import path from 'path';
import * as fs from 'fs';

// wrapper 是额外添加的用于辅助构建 scss AST 的标签
const htmlBlockTagList = ['wrapper', 'a', 'abbr', 'acronym', 'address', 'applet', 'article', 'aside', 'audio', 'b', 'basefont', 'bdi', 'bdo', 'big', 'blockquote', 'button', 'canvas', 'caption', 'center', 'cite', 'code', 'colgroup', 'command', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'dir', 'div', 'dl', 'dt', 'em', 'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'i', 'iframe', 'ins', 'kbd', 'label', 'legend', 'li', 'main', 'map', 'mark', 'menu', 'meter', 'nav', 'noframes', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'section', 'select', 'small', 'span', 'strike', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'tt', 'u', 'ul', 'var', 'video'];
// HTML 自闭合标签
const voidElementList = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr'];
// 是否是html内置组件
function isBuiltInComponents(tag) {
    return [...htmlBlockTagList, ...voidElementList].includes(tag);
}

// ast => selectorTree 将上一步得到的class的ast喜欢换成选择器树
function transform(ast) {
    let selectorRootTree = {
        selectorNames: [],
        children: []
    };
    ast.children;
    selectorRootTree = transformTree(ast);
    // selectorRootTree.children = transformChildren(selectorRootTree, children)
    console.log(JSON.stringify(selectorRootTree));
    return selectorRootTree;
}
function transformTree(ast) {
    // todo
    let selectorRootTree = {
        selectorNames: [],
        children: []
    };
    if (ast.children && ast.children.length) {
        ast.children.forEach((child, index) => {
            const selectorNames = [].concat(transformClass(child.class), transformClass(child.bindClass), transformId(child.id), transformId(child.bindId));
            if (!selectorNames.length && isBuiltInComponents(child.tag)) {
                selectorNames.push(child.tag);
            }
            selectorRootTree.selectorNames = selectorRootTree.selectorNames.concat(selectorNames);
            if (child.children.length) {
                selectorRootTree.children.push(transformTree(child));
            }
            if (!selectorNames.length) {
                selectorRootTree = transformTree(child);
            }
        });
    }
    return selectorRootTree;
}
function transformClass(value) {
    return string2Array(value).map(item => `.${item}`);
}
function transformId(value) {
    return string2Array(value).map(item => `#${item}`);
}
function string2Array(value) {
    return value.split(/\s/).filter(item => item);
}

function parse(html) {
    const root = {
        type: 'root',
        tag: 'root',
        isVoidElement: false,
        class: '',
        bindClass: '',
        id: '',
        bindId: '',
        children: []
    };
    if (!html)
        return root;
    // 匹配字符串 <div> <img /> <div class="foo"> </div> 等
    const tagRE = /<!--[\s\S]*?-->|<(?:"[^"]*"|'[^']*'|[^'">])+>/g;
    let level = 0;
    const stack = [];
    let currentNode;
    html.replace(tagRE, (tag) => {
        console.log(tag);
        if (tag.startsWith('<!--')) {
            return '';
        }
        // 匹配class
        const isStartTag = tag.charAt(1) !== '/';
        // 层级
        if (isStartTag) {
            currentNode = parseTag(tag);
            if (level === 0) {
                root.children.push(currentNode);
                stack.push(currentNode);
            }
            else {
                const parent = stack[level - 1];
                stack.push(currentNode);
                parent.children.push(currentNode);
            }
            level++;
        }
        if (!isStartTag || currentNode.isVoidElement) {
            level--;
            stack.pop();
        }
        return '';
    });
    console.log(JSON.stringify(root));
    return root;
}
function parseTag(tag) {
    const node = {
        type: 'tag',
        isVoidElement: false,
        tag: '',
        class: '',
        bindClass: '',
        id: '',
        bindId: '',
        children: []
    };
    const tagNameMatch = /<([a-zA-Z-]+)/.exec(tag);
    node.tag = tagNameMatch[1];
    node.isVoidElement = voidElementList.includes(node.tag);
    node.class = parseAttr(tag, 'class');
    node.id = parseAttr(tag, 'id');
    node.bindClass = parseBindAttr(tag, 'class');
    node.bindId = parseBindAttr(tag, 'id');
    return node;
}
function parseAttr(tag, attrName) {
    const attrReg = new RegExp(`\\s${attrName}=(('[^']+')|("[^"]+"))`);
    const attrMatch = attrReg.exec(tag);
    return attrMatch ? attrMatch[1].slice(1, -1) : '';
}
function parseBindAttr(tag, attrName) {
    const attrReg = new RegExp(`\\s(v-bind)?:${attrName}=(('[^']+')|("[^"]+"))`);
    const bindAttrMatch = attrReg.exec(tag);
    const rawAttr = bindAttrMatch ? bindAttrMatch[2].slice(1, -1) : '';
    const attr = [];
    rawAttr && rawAttr.replace(/(('[^']')|("[^"]"))/g, (match) => {
        attr.push(match.slice(1, -1));
        return '';
    });
    return attr.join(' ');
}

const rootStrObj = {
    selectorName: '',
    children: [],
    rule: '',
    rnInfo: {}
};
function cloneDeep(val) {
    return JSON.parse(JSON.stringify(val));
}
// 匹配 }
const leftRe = '^\\s*}';
// 匹配 rule
const ruleRe1 = '([^{}]|#{[^}]*})+;(?=[^{:]+?{)';
// 匹配 rule
const ruleRe2 = '([^{}]|#{[^}]*})+?(?=\\s*})';
// 匹配 {
const rightRe = '([^{]|(?<=#){)*{';
// /^\s*}|([^{}]|#{[^}]*})+;(?=[^{:]+?{)|([^{}]|#{[^}]*})+?(?=\s*})|([^{]|(?<=#){)*{/
const re1 = new RegExp(`${leftRe}|${ruleRe1}|${ruleRe2}|${rightRe}`);
// 匹配 scss 注释
const scssCommentRe = /^\s*\/\/[\s\S]*(?=\n)|^\s*\/\*[\s\S]*?\*\//;
let parseContext;
function scssStr2Ast(source, root = cloneDeep(rootStrObj)) {
    if (!parseContext) {
        parseContext = createParserContext(source);
    }
    const s = parseContext.source;
    if (!s.trim())
        return root;
    const match = s.match(re1);
    if (!match) {
        return null;
    }
    let value = match[0];
    // 包含 {，并且不是 scss 插值语句
    if (/[^#]{/.test(value)) {
        advanceBy(parseContext, value.length);
        const child = {
            selectorName: '',
            children: [],
            rule: '',
            parent: root,
            // 选择器名以  @ 开头的，认为是关键字规则
            isKeyRule: value.trim().indexOf('@') === 0,
            rnInfo: {
                start: '',
                end: ''
            }
        };
        // 检查是否有注释
        const commentMt = value.match(scssCommentRe);
        if (commentMt) {
            child.comment = commentMt[0];
            value = value.slice(child.comment.length);
        }
        const selectorMt = value.match(/(\s*)([\s\S]*\S)(\s*){$/);
        child.selectorName = selectorMt[2];
        child.rnInfo.start = selectorMt[1];
        child.rnInfo.startAfter = selectorMt[3];
        root.children.push(child);
        return scssStr2Ast(parseContext.source, child);
    }
    else if (/^\s*}$/.test(value)) {
        // 匹配 }
        root.rnInfo.end = value.match(/^\s*/)[0];
        advanceBy(parseContext, value.length);
        return scssStr2Ast(parseContext.source, root.parent);
    }
    else {
        // 匹配 css规则
        root.rule = (root.rule || '') + s.slice(0, value.length);
        advanceBy(parseContext, value.length);
        return scssStr2Ast(parseContext.source, root);
    }
}
// 推进 删除content.source已经处理过的字符创
function advanceBy(context, length) {
    context.source = context.source.slice(length);
}
function createParserContext(source) {
    return {
        source
    };
}
function resetScss(selectorTree, scssAst, childIndex = 0) {
    if (!selectorTree)
        return;
    const selectorNames = selectorTree.selectorNames;
    for (let i = 0; i < selectorNames.length; i++) {
        const selector = selectorNames[i];
        // 查找当前scssAst中是否已经有模板中的选择器
        const matchIndex = scssAst.children.findIndex((scssAstItem) => {
            return !scssAstItem.hasMatch && (selector === scssAstItem.selectorName || (scssAstItem.selectorName.startsWith('&') && selector === completeSelectorName(scssAst)));
        });
        // 没有的话则代表是新增的选择器去遍历所有的子集
        if (matchIndex === -1) {
            scssAst.children = [
                // 将当前数组按照子集的开始index拆分开, 将新的节点信息插入
                ...scssAst.children.slice(0, childIndex + i),
                {
                    rule: '',
                    // 当前为1时, 遍历他的所有子集
                    children: i === 0 ? trackChildren(selectorTree) : [],
                    rnInfo: {},
                    selectorName: selector,
                    isNew: true
                },
                ...scssAst.children.slice(childIndex + i)
            ];
        }
        else {
            if (i === 0) {
                scssAst.children[matchIndex].hasMatch = true;
                selectorTree.children.forEach((selectorTreeChild, index) => {
                    const scssAstChild = scssAst.children[matchIndex];
                    if (!scssAstChild.isKeyRule) {
                        resetScss(selectorTreeChild, scssAstChild, getPrevSelectorsCount(selectorTree, index));
                    }
                });
            }
        }
    }
}
// 获取当前选择器列表前面所有同级的列表中的selector的数量
function getPrevSelectorsCount(selectorTree, index) {
    // 获取所有之前的列表
    const prevSelectorTreeChildren = selectorTree.children.slice(0, index);
    return prevSelectorTreeChildren.reduce((prev, currentChild) => {
        return prev + currentChild.selectorNames.length;
    }, 0);
}
function trackChildren(selectorTree) {
    const scssAstArr = [];
    for (let i = 0; i < selectorTree.children.length; i++) {
        selectorTree.children[i].selectorNames.forEach((selector, index) => {
            scssAstArr.push({
                rule: '',
                rnInfo: {},
                selectorName: selector,
                children: index === 0 ? trackChildren(selectorTree.children[i]) : [],
                isNew: true
            });
        });
    }
    return scssAstArr;
}
function completeSelectorName(scssAst, name = '') {
    if (scssAst.selectorName.startsWith('&')) {
        const selectorName = scssAst.selectorName;
        return scssAst.parent ?
            completeSelectorName(scssAst.parent, selectorName + name.replace('&', '')) : (selectorName + name);
    }
    return scssAst.selectorName + name.replace('&', '');
}
function generateScss(scssAst, n = 0) {
    if (!scssAst)
        return '';
    const { comment, isNew, rnInfo, selectorName, rule, children } = scssAst;
    const { start, startAfter, end } = rnInfo;
    let scssStr = '';
    scssStr += getDefault(comment); // 注释
    scssStr += isNew ? rnIndent(n) : getDefault(start); // 选择器之前的缩进
    scssStr += selectorName; // 选择器
    scssStr += isNew ? ' ' : getDefault(startAfter); // 选择器之后空格之前的样式
    scssStr += '{';
    if (rule) {
        scssStr += rule;
    }
    if (children.length) {
        const children = distinctChildren(scssAst.children);
        children.forEach(child => {
            scssStr += generateScss(child, n + 1);
        });
    }
    scssStr += isNew ? rnIndent(n) : getDefault(end);
    scssStr += '}';
    return scssStr;
}
// 缩进
function rnIndent(n) {
    return n <= 0 ? '\n' : ('\n' + (' '.repeat(2)).repeat(n));
}
function getDefault(str) {
    return str || '';
}
function distinctChildren(scssAstList) {
    const tempObj = {};
    const distinctArr = [];
    for (let i = 0; i < scssAstList.length; i++) {
        const scssAst = scssAstList[i];
        if (!tempObj[scssAst.selectorName]) {
            if (scssAst.children.length === 0) {
                tempObj[scssAst.selectorName] = true;
            }
            distinctArr.push(scssAst);
        }
        else {
            if (scssAst.children.length !== 0) {
                distinctArr.push(scssAst);
            }
        }
    }
    return distinctArr;
}

var name = "css-structure";
var version = "1.0.2";
var description = "a tool for generate CSS precompiler structure";
var main = "lib/bundel.cjs.js";
var module = "lib/bundel.esm.js";
var scripts = {
	test: "jest",
	build: "rollup -c"
};
var bin = {
	gs: "bin/index.js"
};
var keywords = [
	"css"
];
var author = "hongliang";
var license = "MIT";
var devDependencies = {
	"@babel/core": "^7.18.9",
	"@babel/preset-env": "^7.18.9",
	"@babel/preset-typescript": "^7.18.6",
	"@rollup/plugin-json": "^4.1.0",
	"@rollup/plugin-typescript": "^8.3.4",
	"@types/jest": "^28.1.6",
	"@types/js-beautify": "^1.13.3",
	"@types/lodash-es": "^4.17.6",
	"babel-jest": "^28.1.3",
	commander: "^9.4.0",
	jest: "^28.1.3",
	rollup: "^2.77.2",
	tslib: "^2.4.0",
	typescript: "^4.7.4"
};
var dependencies = {
	"js-beautify": "^1.14.4",
	"lodash-es": "^4.17.21"
};
var pkg = {
	name: name,
	version: version,
	description: description,
	main: main,
	module: module,
	scripts: scripts,
	bin: bin,
	keywords: keywords,
	author: author,
	license: license,
	devDependencies: devDependencies,
	dependencies: dependencies
};

// const ast = parse(template).children[0]
// const selectorTree = transform(ast).children[0]
// const scssAst = scssStr2Ast(`.wrap {
//   .header {
//     .left {
//       .title {
//       }
//       .sub-title {
//       }
//     }
//     .right {
//       .time {
//       }
//     }
//   }
//   .footer {
//     .copyright {
//     }
// }
// }`)
// resetScss(selectorTree, scssAst)
// const scss = generateScss(scssAst.children[0])
// console.log(scss)
// const v= scss
const styleEndTagLength = 8;
function getScssPosition(content, match) {
    const startIndex = content.indexOf(match[1]);
    const endIndex = content.indexOf(match[3]);
    // </style> 的长度
    return {
        startIndex,
        endIndex: endIndex + styleEndTagLength
    };
}
// 拼接scss
function spliceScss4Content(content, startIndex, endIndex, scssContent) {
    return content.slice(0, startIndex) + scssContent + content.slice(endIndex);
}
const program = new Command();
program.command(`file`)
    .description('初始化获取一个文件')
    .argument('<string>', 'a file name')
    .action((fileName) => {
    const filePath = path.resolve(process.cwd(), fileName);
    let content = fs.readFileSync(filePath, {
        encoding: 'utf-8'
    });
    const templateRe = /<template[^>]*>([\s\S]*)<\/template>/;
    const styleRe = /(<style[^>]*>)([\s\S]*)(<\/style>)/;
    const matchTemplateArr = content.match(templateRe);
    const matchStyleArr = content.match(styleRe);
    const matchTemplate = matchTemplateArr ? matchTemplateArr[1] : '';
    const matchStyle = matchStyleArr ? matchStyleArr[2] : '';
    const ast = parse(matchTemplate);
    const selectorTree = transform(ast).children[0];
    const scssAst = scssStr2Ast(matchStyle);
    resetScss(selectorTree, scssAst);
    const scss = generateScss(scssAst.children[0]);
    if (matchStyleArr) {
        const { startIndex, endIndex } = getScssPosition(content, matchStyleArr);
        const matchStyleStart = matchStyleArr ? matchStyleArr[1] : '';
        const matchStyleEnd = matchStyleArr ? matchStyleArr[3] : '';
        const scssContent = matchStyleStart + scss + '\n' + matchStyleEnd;
        content = spliceScss4Content(content, startIndex, endIndex, scssContent);
    }
    else {
        content += '<style lang=\"scss\" scoped>' + scss + '\n' + '</style>';
    }
    fs.writeFileSync(filePath, content);
});
program.version(pkg.version);
program.parse(process.argv);

export { parse };
