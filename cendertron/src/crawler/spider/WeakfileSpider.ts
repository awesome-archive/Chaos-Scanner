/** 默认页面爬虫 */
import * as puppeteer from 'puppeteer';

import { ISpider } from './ISpider';
import Spider from './Spider';
import { logger } from '../supervisor/logger';
import { initPage } from '../../render/puppeteer';
import { transfromUrlToResult } from '../../utils/transformer';
import { evaluateWeakfileScan } from '../../render/monky/weak-file';

export class WeakfileSpider extends Spider implements ISpider {
  // 目标页面
  page?: puppeteer.Page;

  /** 初始化蜘蛛 */
  async init() {
    if (!this.crawler.browser) {
      logger.error('Crawler context is not readdy!');
      return;
    }

    this.page = await initPage(this.crawler.browser);

    // 如果创建失败，则直接返回
    if (!this.page) {
      this.finish();
      return;
    }

    try {
      // 判断是否存在 cookie
      if (this.spiderPage.cookies) {
        await this.page.setCookie(...(this.spiderPage.cookies || []));
      }
    } catch (e) {
      console.error(e);
    }
  }

  /** 复写父类方法 */
  public async run() {
    if (!this.page) {
      throw new Error('Please init this spider!');
    }

    try {
      // 页面跳转
      const resp = await this.page!.goto(this.pageUrl, {
        timeout: this.crawler.crawlerOption.pageTimeout,

        // 等待到页面加载完毕
        waitUntil: 'domcontentloaded'
      });

      // 如果是 404 界面，则直接返回
      if (resp && resp.status() === 404) {
        this.finish();

        return;
      }

      const availableUrls = await evaluateWeakfileScan(this.page, this.pageUrl);

      // 执行敏感文件扫描
      // 将所有打开的页面加入
      availableUrls.forEach(url => {
        const r = transfromUrlToResult(url);
        r.resourceType = 'document';

        this.crawler._SPIDER_addRequest(this, r);
      });
    } catch (e) {
      logger.error(`spider-error>>>${e.message}>>>${this.pageUrl}`);
    } finally {
      this.finish();
    }
  }

  /** 执行结束时候操作 */
  private async finish() {
    if (!this.page) {
      return;
    }

    try {
      // 确保页面关闭
      if (!this.page.isClosed()) {
        this.page.close().catch(_ => {});
      }
    } catch (_) {
      // 这里忽略异常
    }

    this.crawler.next();
  }
}
