/*
  api地址
  获取推荐列表 https://api.juejin.cn/recommend_api/v1/article/recommend_cate_feed
  获取文章详情 https://api.juejin.cn/content_api/v1/article/detail
*/

const axios = require('axios');
const fs = require('fs');
const xlsx = require('node-xlsx');

fs.readFile('./config.json','utf-8',(err,data)=>{
  if(err) return;
  //读取配置信息
  let config = null;
  try{
    config = JSON.parse(data);
  }catch(err){
    throw TypeError('config解析错误');
  }
  //上一次创建到第几个文件
  const lastFileNumber = config.lastFileNumber;
  //总共需要几条数据
  const total = config.requestCount;
  //上一次数据请求的位置
  const lastCursor = config.lastCursor;
  //总共应该请求几次
  const count = Math.ceil(total/20);
  //当前请求第几次
  let current = 1;
  //当前请求数据的位置
  let currentCursor = lastCursor;
  //文章id列表
  let articleIdList = [];
  //存储文章详情
  let model = [];
  //excel表格数据
  let excelData = [];

  //读表格数据
  // const readExcel = ()=>{
  //   // 解析得到文档中的所有 sheet
  //   const sheets = xlsx.parse('./model.xlsx'); 
  //   // 遍历 sheet
  //   sheets.forEach((sheet)=>{
  //     console.log(sheet['name']);
  //     //读取每行内容
  //     for(let rowId in sheet['data']){
  //       console.log(rowId);
  //       const row = sheet['data'][rowId];
  //       console.log(row);
  //     }
  //   })
  // };

  //处理表格数据
  const handleExcel = (model)=>{
    let sheetData = [
      [
        '文章标题',
        '文章路径',
        '作者',
        '分类',
        '标签',
        '浏览量',
        '评论量',
        '点赞数'
      ]
    ];

    model.forEach((item)=>{
      let arr = [];
      arr.push(item.title);
      arr.push(item.url);
      arr.push(item.author);
      arr.push(item.category);
      arr.push(item.tags);
      arr.push(item.view_count);
      arr.push(item.comment_count);
      arr.push(item.digg_count);
      sheetData.push(arr);
    });

    let newSheet = {
      name: '掘金推荐',
      data: sheetData
    };

    excelData.push(newSheet);
    
    const buffer = xlsx.build(excelData);
    //写入文件
    fs.writeFile(`./model${lastFileNumber}.xlsx`, buffer, (err)=>{
      if (err) {
        console.log("Write failed: " + err);
        return
      }
      console.log("Write completed.");
    });
  }

  //处理文章详情中的tags信息
  const tagsHandle = (tagsList)=>{
    let tags = '';
    tagsList.forEach((item,index)=>{
      if(index===0){
        tags += item.tag_name;
      }else{
        tags += `/${item.tag_name}`;
      }
    })
    return tags
  };

  //文章列表数据请求完成后，将当前请求位置记录下来，作为下次请求的起始位置
  const recordCursor = ()=>{
    const currentContent = {
      lastCursor: currentCursor,
      requestCount: total,
      lastFileNumber: lastFileNumber + 1
    };
    fs.writeFile('./config.json',JSON.stringify(currentContent),err=>{
      err && console.log(err)
    });
  }

  //遍历文章id依次进行文章详情的请求
  const traverse = (articleIdList)=>{
    let i = 0;
    return function recursion(data){
      if(i >= articleIdList.length){
        handleExcel(data);
      }
      let id = articleIdList[i++];
      return axios.post('https://api.juejin.cn/content_api/v1/article/detail',{
        article_id: id
      }).then(res=>{
        //因拿到的文章标签信息是数组，这里需要处理标签信息拿到我们想要的字符串格式
        let tagsInfo = tagsHandle(res.data.data.tags);
        model.push({
          //标题
          title: res.data.data.article_info.title,
          //路径
          url: 'https://juejin.cn/post/' + res.data.data.article_id,
          //作者
          author: res.data.data.author_user_info.user_name,
          //分类
          category: res.data.data.category.category_name,
          //标签
          tags: tagsInfo,
          //浏览量
          view_count: res.data.data.article_info.view_count,
          //评论数
          comment_count: res.data.data.article_info.comment_count,
          //点赞数
          digg_count: res.data.data.article_info.digg_count
        });
        setTimeout(()=>{
          recursion(model);
        },800);
      }).catch(err=>{
        console.log('err_here:',err);
      })
    }
  }

  //请求前端文章列表数据
  const request = (cursor,current)=>{
    //当前请求第几次小于或等于应请求次数,则发起请求
    if(current <= count){
      axios.post('https://api.juejin.cn/recommend_api/v1/article/recommend_cate_feed',{
        cate_id: "6809637767543259144",
        cursor,
        id_type: 2,
        limit: 20,
        sort_type: 200
      }).then(res=>{
        //将请求得到的articleId放入数组中存起来
        res.data.data.forEach(item=>{
          articleIdList.push(item.article_id);
        });
        currentCursor = res.data.cursor;
        current++;
        setTimeout(()=>{
          request(currentCursor,current);
        },1000);
      })
    }else{
      recordCursor();
      traverse(articleIdList)([]);
    }
  }

  request(lastCursor,current);
})

