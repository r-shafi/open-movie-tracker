import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { SharedModuleModule } from '../shared-module/shared-module.module';
import { TabsPageRoutingModule } from './tabs-routing.module';
import { TabsPage } from './tabs.page';

@NgModule({
  imports: [CommonModule, IonicModule, TabsPageRoutingModule, SharedModuleModule],
  declarations: [TabsPage],
})
export class TabsPageModule {}
